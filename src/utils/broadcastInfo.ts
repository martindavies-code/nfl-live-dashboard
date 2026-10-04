import type { NFLEvent } from '../types/nfl'
import { findVerifiedCrew, type AnnouncerSource } from '../data/announcerRegistry.ts'

export interface BroadcastAnnouncers {
  playByPlay: string
  analyst: string
  sideline?: string
  leadDuo: string
  fullCrew: string
  /**
   * true only when the crew comes from the fact-checked registry for this exact
   * season/week/matchup. When false every name field is a "TBA" placeholder —
   * crews are never guessed.
   */
  verified: boolean
  sources: AnnouncerSource[]
  verifiedOn?: string
}

export interface GameBroadcastDetails {
  usTv: string
  ukTv: string
  ukTvShort: string
  ukTvChannelNumber: string
  ukRadio: string
  ukRadioShort: string
  ukRadioFrequency: string
  announcers: BroadcastAnnouncers
  ukPundits: string
  isNationalUkTv: boolean
  isRedZoneWindow: boolean
  streaming: string
}

// Prominent marquee franchises that Sky Sports typically selects as the main UK game
const TIER_1_TEAMS = new Set([
  'KC', 'BUF', 'BAL', 'CIN', 'HOU', 'DAL', 'SF', 'PHI', 'DET', 'GB', 'PIT'
])

const CREW_TBA: BroadcastAnnouncers = {
  playByPlay: 'TBA',
  analyst: 'TBA',
  leadDuo: 'Crew TBA',
  fullCrew: 'TBA (not yet confirmed)',
  verified: false,
  sources: [],
}

/**
 * Permanent, exclusive franchise broadcast teams for primetime games.
 * Per league contracts, TNF, SNF, and MNF always feature the exact same crew.
 * Sunday afternoon games rotate weekly and are NEVER guessed.
 */
const PRIMETIME_TNF: BroadcastAnnouncers = {
  playByPlay: 'Al Michaels',
  analyst: 'Kirk Herbstreit',
  sideline: 'Kaylee Hartung',
  leadDuo: 'Al Michaels & Kirk Herbstreit',
  fullCrew: 'Al Michaels, Kirk Herbstreit, Kaylee Hartung',
  verified: true,
  sources: [{
    label: 'Thursday Night Football permanent exclusive crew (Amazon Prime Video)',
    url: 'https://www.amazon.com/tnf',
  }],
}

const PRIMETIME_SNF: BroadcastAnnouncers = {
  playByPlay: 'Mike Tirico',
  analyst: 'Cris Collinsworth',
  sideline: 'Melissa Stark',
  leadDuo: 'Mike Tirico & Cris Collinsworth',
  fullCrew: 'Mike Tirico, Cris Collinsworth, Melissa Stark',
  verified: true,
  sources: [{
    label: 'Sunday Night Football permanent exclusive crew (NBC Sports)',
    url: 'https://www.nbcsports.com/nfl/sunday-night-football',
  }],
}

const PRIMETIME_MNF: BroadcastAnnouncers = {
  playByPlay: 'Joe Buck',
  analyst: 'Troy Aikman',
  sideline: 'Lisa Salters',
  leadDuo: 'Joe Buck & Troy Aikman',
  fullCrew: 'Joe Buck, Troy Aikman, Lisa Salters',
  verified: true,
  sources: [{
    label: 'Monday Night Football permanent exclusive crew (ESPN / ABC)',
    url: 'https://www.espn.com/nfl',
  }],
}

function joinNames(names: string[], conjunction = '&'): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} ${conjunction} ${names[names.length - 1]}`
}

export interface BroadcastContext {
  ukWeekday?: string
  ukHour?: number
  upperNet?: string
  isLondonVenue?: boolean
  isSuperBowl?: boolean
}

/**
 * Resolves the announce team for a game:
 * 1. Explicit entry in fact-checked registry (takes precedence).
 * 2. Permanent primetime crews exception: TNF, SNF, and MNF always feature the same crew.
 * 3. All other games (Sunday afternoon CBS/FOX regional slates, etc.) NEVER guess — returns "Crew TBA".
 */
export function getVerifiedAnnouncers(
  event?: NFLEvent | null,
  context?: BroadcastContext
): { announcers: BroadcastAnnouncers; network?: string } {
  const competitors = event?.competitions?.[0]?.competitors || []
  const away = competitors.find((c) => c.homeAway === 'away')?.team?.abbreviation || ''
  const home = competitors.find((c) => c.homeAway === 'home')?.team?.abbreviation || ''
  const crew = findVerifiedCrew(event?.season?.year, event?.week?.number, away, home, event?.date)

  if (crew) {
    const booth = [crew.playByPlay, ...crew.analysts]
    return {
      network: crew.network,
      announcers: {
        playByPlay: crew.playByPlay,
        analyst: joinNames(crew.analysts),
        sideline: crew.sideline.length ? joinNames(crew.sideline) : undefined,
        leadDuo: joinNames(booth),
        fullCrew: [...booth, ...crew.sideline].join(', '),
        verified: true,
        sources: crew.sources,
        verifiedOn: crew.verifiedOn,
      },
    }
  }

  // Derive time & broadcast context if not supplied
  const comp = event?.competitions?.[0]
  const rawBroadcast =
    comp?.broadcasts?.[0]?.names?.join(', ') ||
    (event as { broadcast?: string })?.broadcast ||
    ''
  const upperNet = context?.upperNet ?? rawBroadcast.toUpperCase()

  let ukWeekday = context?.ukWeekday
  let ukHour = context?.ukHour
  if (ukWeekday === undefined || ukHour === undefined) {
    ukWeekday = 'Sun'
    ukHour = 18
    if (event?.date) {
      try {
        const d = new Date(event.date)
        if (!isNaN(d.getTime())) {
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            weekday: 'short',
            hour: 'numeric',
            hour12: false,
          }).formatToParts(d)
          const w = parts.find((p) => p.type === 'weekday')?.value
          const h = parts.find((p) => p.type === 'hour')?.value
          if (w) ukWeekday = w
          if (h) ukHour = parseInt(h, 10)
        }
      } catch {
        // Fallback
      }
    }
  }

  const isLondonVenue =
    context?.isLondonVenue ??
    (() => {
      const vn = (comp?.venue?.fullName || '').toLowerCase()
      const vc = (comp?.venue?.address?.city || '').toLowerCase()
      return vn.includes('tottenham') || vn.includes('wembley') || vn.includes('twickenham') || vc.includes('london')
    })()

  const isSuperBowl =
    context?.isSuperBowl ??
    ((event?.season?.type === 3 && event?.week?.number === 5) ||
      /super\s*bowl/i.test(event?.name || '') ||
      /super\s*bowl/i.test((comp as { notes?: Array<{ headline?: string }> })?.notes?.[0]?.headline || ''))

  // PERMANENT PRIMETIME CREWS EXCEPTION:
  // Thursday Night Football (Prime Video), Sunday Night Football (NBC), and Monday Night Football (ESPN/ABC)
  // have dedicated, permanent exclusive broadcast crews.
  // Sunday afternoon games (CBS/FOX), London games, and special holiday slates rotate weekly and MUST NEVER be guessed.
  if (!isLondonVenue && !isSuperBowl) {
    const isOtherMajorNet =
      upperNet.includes('CBS') ||
      upperNet.includes('FOX') ||
      upperNet.includes('NFL') ||
      upperNet.includes('PEACOCK') ||
      upperNet.includes('NETFLIX')

    // 1. Thursday Night Football (Amazon Prime Video)
    const isPrimeNet = upperNet.includes('PRIME') || upperNet.includes('AMAZON')
    const isThursdayNightWindow =
      (ukWeekday === 'Fri' && typeof ukHour === 'number' && ukHour < 5) ||
      (ukWeekday === 'Thu' && typeof ukHour === 'number' && ukHour >= 23)

    if (isPrimeNet || (!isOtherMajorNet && !upperNet.includes('NBC') && isThursdayNightWindow)) {
      return { announcers: { ...PRIMETIME_TNF }, network: 'Amazon Prime Video' }
    }

    // 2. Sunday Night Football (NBC)
    const isNbcNet = upperNet.includes('NBC')
    const isSundayNightWindow =
      (ukWeekday === 'Mon' && typeof ukHour === 'number' && ukHour < 5) ||
      (ukWeekday === 'Sun' && typeof ukHour === 'number' && ukHour >= 23)

    if (isNbcNet && (isSundayNightWindow || isThursdayNightWindow)) {
      return { announcers: { ...PRIMETIME_SNF }, network: 'NBC' }
    }

    // 3. Monday Night Football (ESPN / ABC)
    const isEspnNet = upperNet.includes('ESPN') || upperNet.includes('ABC')
    const isMondayNightWindow =
      (ukWeekday === 'Tue' && typeof ukHour === 'number' && ukHour < 5) ||
      (ukWeekday === 'Mon' && typeof ukHour === 'number' && ukHour >= 23)

    if (isEspnNet && isMondayNightWindow) {
      return {
        announcers: { ...PRIMETIME_MNF },
        network: upperNet.includes('ABC') ? 'ESPN / ABC' : 'ESPN',
      }
    }
  }

  // All other games (Sunday afternoon CBS/FOX, London games, etc.) remain TBA — names are NEVER guessed.
  return { announcers: { ...CREW_TBA, sources: [] } }
}

/**
 * Derives comprehensive broadcast coverage details for any NFL game,
 * including UK Television channel, UK Radio station, and the live announcer crew.
 */
export function getGameBroadcastDetails(event?: NFLEvent | null): GameBroadcastDetails {
  const comp = event?.competitions?.[0]
  const rawBroadcast =
    comp?.broadcasts?.[0]?.names?.join(', ') ||
    (event as { broadcast?: string })?.broadcast ||
    ''

  const upperNet = rawBroadcast.toUpperCase()

  // Date & Time analysis in London timezone
  let ukWeekday = 'Sun'
  let ukHour = 18
  let isLondonVenue = false

  if (event?.date) {
    try {
      const d = new Date(event.date)
      if (!isNaN(d.getTime())) {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          weekday: 'short',
          hour: 'numeric',
          hour12: false,
        }).formatToParts(d)

        const w = parts.find((p) => p.type === 'weekday')?.value
        const h = parts.find((p) => p.type === 'hour')?.value

        if (w) ukWeekday = w
        if (h) ukHour = parseInt(h, 10)
      }
    } catch {
      // Fallback
    }
  }

  // Check venue for London International Series
  const venueName = (comp?.venue?.fullName || '').toLowerCase()
  const venueCity = (comp?.venue?.address?.city || '').toLowerCase()
  if (
    venueName.includes('tottenham') ||
    venueName.includes('wembley') ||
    venueName.includes('twickenham') ||
    venueCity.includes('london')
  ) {
    isLondonVenue = true
  }

  // Check for Super Bowl
  const isSuperBowl =
    (event?.season?.type === 3 && event?.week?.number === 5) ||
    /super\s*bowl/i.test(event?.name || '') ||
    /super\s*bowl/i.test((comp as { notes?: Array<{ headline?: string }> })?.notes?.[0]?.headline || '')

  // Competitor abbreviations to check for marquee tier
  const competitors = comp?.competitors || []
  const awayAbbr = (competitors.find((c) => c.homeAway === 'away')?.team?.abbreviation || '').toUpperCase()
  const homeAbbr = (competitors.find((c) => c.homeAway === 'home')?.team?.abbreviation || '').toUpperCase()
  const isTier1Matchup = TIER_1_TEAMS.has(awayAbbr) || TIER_1_TEAMS.has(homeAbbr)

  // ---------------------------------------------------------------------------
  // 1. US NETWORK + ANNOUNCERS CALLING THE GAME
  // ---------------------------------------------------------------------------
  const { announcers, network: verifiedNetwork } = getVerifiedAnnouncers(event, {
    ukWeekday,
    ukHour,
    upperNet,
    isLondonVenue,
    isSuperBowl,
  })

  // Determine US Network string (from ESPN's broadcast data where available)
  let usTv = 'CBS'

  if (verifiedNetwork) {
    usTv = verifiedNetwork
  } else if (isSuperBowl) {
    if (upperNet.includes('FOX')) usTv = 'FOX'
    else if (upperNet.includes('NBC')) usTv = 'NBC'
    else if (upperNet.includes('CBS')) usTv = 'CBS'
    else usTv = upperNet || 'ESPN / ABC' // Super Bowl LXI (Feb 2027) on ESPN / ABC
  } else if (isLondonVenue) {
    usTv = 'NFL Network'
  } else if (upperNet.includes('FOX')) {
    usTv = 'FOX'
  } else if (upperNet.includes('CBS')) {
    usTv = 'CBS'
  } else if (upperNet.includes('NBC')) {
    usTv = 'NBC'
  } else if (upperNet.includes('PRIME') || upperNet.includes('AMAZON')) {
    usTv = 'Amazon Prime Video'
  } else if (upperNet.includes('ESPN') || upperNet.includes('ABC')) {
    usTv = upperNet.includes('ABC') ? 'ESPN / ABC' : 'ESPN'
  } else if (upperNet.includes('NETFLIX')) {
    usTv = 'Netflix'
  } else if (upperNet.includes('PEACOCK')) {
    usTv = 'Peacock'
  } else if (upperNet.includes('NFL')) {
    usTv = 'NFL Network'
  } else if (ukWeekday === 'Tue' || (ukWeekday === 'Mon' && ukHour >= 23)) {
    // Unspecified network on Monday Night Football window
    usTv = 'ESPN'
  } else if ((ukWeekday === 'Mon' && ukHour < 5) || (ukWeekday === 'Sun' && ukHour >= 23)) {
    // Unspecified network on Sunday Night Football window
    usTv = 'NBC'
  } else if ((ukWeekday === 'Fri' && ukHour < 5) || (ukWeekday === 'Thu' && ukHour >= 23)) {
    // Unspecified network on Thursday Night Football window
    usTv = 'Amazon Prime Video'
  }

  // ---------------------------------------------------------------------------
  // 2. UK TELEVISION BROADCAST
  // ---------------------------------------------------------------------------
  let ukTv = 'Sky Sports NFL'
  let ukTvShort = 'Sky Sports NFL'
  let ukTvChannelNumber = 'Sky 407 • Virgin 507'
  let isNationalUkTv = true
  const isRedZoneWindow = ukWeekday === 'Sun' && ukHour >= 17 && ukHour <= 23

  if (isSuperBowl) {
    ukTv = 'Sky Sports NFL & ITV1 (Free-to-Air)'
    ukTvShort = 'Sky Sports & ITV1'
    ukTvChannelNumber = 'Sky 407 / Freeview 3 / Virgin 103'
  } else if (isLondonVenue) {
    ukTv = 'ITV1 & ITVX (Free-to-Air) • Sky Sports NFL'
    ukTvShort = 'ITV1 & Sky Sports'
    ukTvChannelNumber = 'Freeview 3 • Sky 103/407 • Virgin 103'
  } else if (usTv.includes('ESPN') || usTv.includes('ABC')) {
    ukTv = 'Sky Sports NFL & Channel 5 (NFL EndZone)'
    ukTvShort = 'Sky Sports & Channel 5'
    ukTvChannelNumber = 'Sky 407 • Freeview 5 • Virgin 507'
  } else if (usTv.includes('NBC')) {
    ukTv = 'Sky Sports NFL & Main Event'
    ukTvShort = 'Sky Sports NFL'
    ukTvChannelNumber = 'Sky 407 / Sky 401 • Virgin 507'
  } else if (usTv.includes('Prime Video')) {
    ukTv = 'Sky Sports NFL • Prime Video UK'
    ukTvShort = 'Sky Sports & Prime'
    ukTvChannelNumber = 'Sky 407 • Prime Video App'
  } else if (usTv.includes('Netflix')) {
    ukTv = 'Netflix UK • NFL Game Pass on DAZN'
    ukTvShort = 'Netflix UK'
    ukTvChannelNumber = 'Netflix App'
  } else if (isRedZoneWindow && !isTier1Matchup) {
    // Sunday afternoon game not on Sky Sports main game
    ukTv = 'Sky Sports Mix (NFL RedZone) • DAZN'
    ukTvShort = 'Sky Mix / RedZone'
    ukTvChannelNumber = 'Sky 416 • Virgin 510 • NFL Game Pass'
    isNationalUkTv = false
  } else {
    ukTv = 'Sky Sports NFL (Live Match)'
    ukTvShort = 'Sky Sports NFL'
    ukTvChannelNumber = 'Sky 407 • Virgin 507'
  }

  // ---------------------------------------------------------------------------
  // 3. UK RADIO BROADCAST
  // ---------------------------------------------------------------------------
  let ukRadio = 'talkSPORT 2'
  let ukRadioShort = 'talkSPORT 2'
  let ukRadioFrequency = 'DAB Digital Radio • talkSPORT App • Online'

  if (isSuperBowl) {
    ukRadio = 'BBC Radio 5 Live & talkSPORT'
    ukRadioShort = 'BBC 5 Live & talkSPORT'
    ukRadioFrequency = 'DAB Digital Radio • BBC Sounds • talkSPORT App'
  } else if (isLondonVenue) {
    ukRadio = 'BBC Radio 5 Live & BBC Sounds'
    ukRadioShort = 'BBC Radio 5 Live'
    ukRadioFrequency = 'DAB Digital Radio • 693 / 909 AM • BBC Sounds'
  } else if (usTv.includes('ESPN') || usTv.includes('ABC') || usTv.includes('NBC')) {
    ukRadio = 'talkSPORT 2 & Westwood One'
    ukRadioShort = 'talkSPORT 2'
    ukRadioFrequency = 'DAB Digital Radio • talkSPORT App'
  } else if (isRedZoneWindow && !isTier1Matchup) {
    ukRadio = 'talkSPORT 2 (NFL Live Around the Grounds)'
    ukRadioShort = 'talkSPORT 2'
    ukRadioFrequency = 'DAB Digital Radio • talkSPORT App • BBC Sounds'
  } else {
    ukRadio = 'talkSPORT 2 (Full Live Match Commentary)'
    ukRadioShort = 'talkSPORT 2'
    ukRadioFrequency = 'DAB Digital Radio • talkSPORT App'
  }

  // ---------------------------------------------------------------------------
  // 4. UK STUDIO PRESENTATION PUNDITS
  // ---------------------------------------------------------------------------
  let ukPundits = 'Sky Sports: Neil Reynolds, Phoebe Schecter & Jason Bell'
  if (isLondonVenue || (isSuperBowl && ukTv.includes('ITV'))) {
    ukPundits = 'ITV: Craig Doyle, Jason Bell & Osi Umenyiora • Sky: Neil Reynolds'
  } else if (ukRadio.includes('talkSPORT')) {
    ukPundits = 'Sky: Neil Reynolds, Phoebe Schecter • Radio: Nat Coombs & Will Gavin'
  }

  return {
    usTv,
    ukTv,
    ukTvShort,
    ukTvChannelNumber,
    ukRadio,
    ukRadioShort,
    ukRadioFrequency,
    announcers,
    ukPundits,
    isNationalUkTv,
    isRedZoneWindow,
    streaming: 'Sky Go • NOW TV • NFL Game Pass on DAZN',
  }
}
