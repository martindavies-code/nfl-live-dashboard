import type { NFLEvent } from '../types/nfl'

export interface BroadcastAnnouncers {
  playByPlay: string
  analyst: string
  sideline?: string
  leadDuo: string
  fullCrew: string
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

// Prominent marquee franchises that CBS and FOX typically designate for A-Crew national telecasts
const TIER_1_TEAMS = new Set([
  'KC', 'BUF', 'BAL', 'CIN', 'HOU', 'DAL', 'SF', 'PHI', 'DET', 'GB', 'PIT'
])

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
  // 1. ANNOUNCERS CALLING THE GAME
  // ---------------------------------------------------------------------------
  let announcers: BroadcastAnnouncers = {
    playByPlay: 'Ian Eagle',
    analyst: 'Charles Davis',
    sideline: 'Evan Washburn',
    leadDuo: 'Ian Eagle & Charles Davis',
    fullCrew: 'Ian Eagle, Charles Davis, Evan Washburn',
  }

  // Determine US Network string
  let usTv = 'CBS'

  if (isSuperBowl) {
    usTv = upperNet || 'CBS / FOX / NBC'
    announcers = {
      playByPlay: 'Jim Nantz',
      analyst: 'Tony Romo',
      sideline: 'Tracy Wolfson & Evan Washburn',
      leadDuo: 'Jim Nantz & Tony Romo',
      fullCrew: 'Jim Nantz, Tony Romo, Tracy Wolfson, Evan Washburn',
    }
  } else if (isLondonVenue) {
    usTv = 'NFL Network'
    announcers = {
      playByPlay: 'Rich Eisen',
      analyst: 'Kurt Warner',
      sideline: 'Stacey Dales & Jamie Erdahl',
      leadDuo: 'Rich Eisen & Kurt Warner',
      fullCrew: 'Rich Eisen, Kurt Warner, Stacey Dales',
    }
  } else if (upperNet.includes('ESPN') || upperNet.includes('ABC') || ukWeekday === 'Tue' || (ukWeekday === 'Mon' && ukHour >= 23)) {
    // Monday Night Football
    usTv = upperNet.includes('ABC') ? 'ESPN / ABC' : 'ESPN'
    announcers = {
      playByPlay: 'Joe Buck',
      analyst: 'Troy Aikman',
      sideline: 'Lisa Salters',
      leadDuo: 'Joe Buck & Troy Aikman',
      fullCrew: 'Joe Buck, Troy Aikman, Lisa Salters',
    }
  } else if (upperNet.includes('NBC') || (ukWeekday === 'Mon' && ukHour < 5) || (ukWeekday === 'Sun' && ukHour >= 23)) {
    // Sunday Night Football
    usTv = 'NBC'
    announcers = {
      playByPlay: 'Mike Tirico',
      analyst: 'Cris Collinsworth',
      sideline: 'Melissa Stark',
      leadDuo: 'Mike Tirico & Cris Collinsworth',
      fullCrew: 'Mike Tirico, Cris Collinsworth, Melissa Stark',
    }
  } else if (upperNet.includes('PRIME') || upperNet.includes('AMAZON') || (ukWeekday === 'Fri' && ukHour < 5) || (ukWeekday === 'Thu' && ukHour >= 23)) {
    // Thursday Night Football
    usTv = 'Amazon Prime Video'
    announcers = {
      playByPlay: 'Al Michaels',
      analyst: 'Kirk Herbstreit',
      sideline: 'Kaylee Hartung',
      leadDuo: 'Al Michaels & Kirk Herbstreit',
      fullCrew: 'Al Michaels, Kirk Herbstreit, Kaylee Hartung',
    }
  } else if (upperNet.includes('NETFLIX')) {
    // Christmas Special
    usTv = 'Netflix'
    announcers = {
      playByPlay: 'Noah Eagle',
      analyst: 'Greg Olsen',
      sideline: 'Kaylee Hartung',
      leadDuo: 'Noah Eagle & Greg Olsen',
      fullCrew: 'Noah Eagle, Greg Olsen, Kaylee Hartung',
    }
  } else if (upperNet.includes('PEACOCK')) {
    usTv = 'Peacock'
    announcers = {
      playByPlay: 'Mike Tirico',
      analyst: 'Jason Garrett',
      sideline: 'Zora Stephenson',
      leadDuo: 'Mike Tirico & Jason Garrett',
      fullCrew: 'Mike Tirico, Jason Garrett, Zora Stephenson',
    }
  } else if (upperNet.includes('FOX')) {
    usTv = 'FOX'
    // Late window (4:25 PM ET / 9:25 PM UK) or Tier 1 gets Burkhardt & Brady
    if (ukHour >= 21 || isTier1Matchup) {
      announcers = {
        playByPlay: 'Kevin Burkhardt',
        analyst: 'Tom Brady',
        sideline: 'Erin Andrews & Tom Rinaldi',
        leadDuo: 'Kevin Burkhardt & Tom Brady',
        fullCrew: 'Kevin Burkhardt, Tom Brady, Erin Andrews, Tom Rinaldi',
      }
    } else {
      announcers = {
        playByPlay: 'Joe Davis',
        analyst: 'Greg Olsen',
        sideline: 'Pam Oliver',
        leadDuo: 'Joe Davis & Greg Olsen',
        fullCrew: 'Joe Davis, Greg Olsen, Pam Oliver',
      }
    }
  } else {
    // Default CBS
    usTv = 'CBS'
    if (ukHour >= 21 || isTier1Matchup) {
      announcers = {
        playByPlay: 'Jim Nantz',
        analyst: 'Tony Romo',
        sideline: 'Tracy Wolfson',
        leadDuo: 'Jim Nantz & Tony Romo',
        fullCrew: 'Jim Nantz, Tony Romo, Tracy Wolfson',
      }
    } else {
      announcers = {
        playByPlay: 'Ian Eagle',
        analyst: 'Charles Davis',
        sideline: 'Evan Washburn',
        leadDuo: 'Ian Eagle & Charles Davis',
        fullCrew: 'Ian Eagle, Charles Davis, Evan Washburn',
      }
    }
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
