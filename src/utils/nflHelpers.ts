import type { NFLSituation, NFLCompetitor, NFLStatus } from '../types/nfl'

/**
 * Safely parse score or number strings, handling "-", empty strings, or nulls without returning NaN.
 */
export function safeParseInt(val: string | number | undefined | null, fallback = 0): number {
  if (val === undefined || val === null) return fallback
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback
  const clean = String(val).trim()
  if (clean === '' || clean === '-') return fallback
  const parsed = parseInt(clean, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Normalize and sanitize team hex color strings (handles missing '#', 3-char hex, invalid chars).
 */
export function sanitizeHexColor(hex?: string, fallback = '#1e3a8a'): string {
  if (!hex || typeof hex !== 'string') return fallback
  const clean = hex.replace('#', '').trim()
  if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return `#${clean}`
  }
  if (/^[0-9A-Fa-f]{3}$/.test(clean)) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
  }
  return fallback
}

/**
 * Compute whether text on top of this color should be white or black for optimal contrast.
 */
export function getContrastYIQ(hexcolor: string): 'black' | 'white' {
  const clean = hexcolor.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 0
  const b = parseInt(clean.substring(4, 6), 16) || 0
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? 'black' : 'white'
}

/**
 * Converts a hex color to RGB array [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = sanitizeHexColor(hex).replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 0
  const b = parseInt(clean.substring(4, 6), 16) || 0
  return [r, g, b]
}

/**
 * Converts RGB components (0-255) to HSL [h (0-360), s (0-100), l (0-100)].
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      case bNorm:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h = Math.round(h * 60)
  }
  return [h, Math.round(s * 100), Math.round(l * 100)]
}

/**
 * Determines whether two colors are visually too similar for a split comparison bar.
 * Checks perceptual color distance, hue proximity, and luminance clash.
 */
export function areColorsTooSimilar(hex1: string, hex2: string): boolean {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)

  // Perceptual color distance weighted by human visual sensitivity (redmean formula)
  const rmean = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  const distance = Math.sqrt((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db)

  if (distance < 135) return true

  const [h1, s1, l1] = rgbToHsl(r1, g1, b1)
  const [h2, s2, l2] = rgbToHsl(r2, g2, b2)

  // If both are very dark or very desaturated (e.g. black, dark navy)
  if (l1 < 25 && l2 < 25) return true

  // Hue difference on a 360-degree circle
  const rawHueDiff = Math.abs(h1 - h2)
  const hueDiff = Math.min(rawHueDiff, 360 - rawHueDiff)

  // If both colors share a similar hue (e.g. blue vs navy, or red vs crimson) and neither has dramatic contrast
  if (hueDiff < 45 && Math.abs(l1 - l2) < 35 && s1 > 15 && s2 > 15) {
    return true
  }

  return false
}

/**
 * Ensures team colors have strong, broadcast-grade visual distinction for win probability bars.
 * Automatically switches to alternate colors or distinct harmonious accents when primary team colors clash.
 */
export function resolveContrastingTeamColors(
  homeComp?: NFLCompetitor | null,
  awayComp?: NFLCompetitor | null
): { homeColor: string; awayColor: string } {
  const homePrimary = sanitizeHexColor(homeComp?.team?.color, '#00338d')
  const awayPrimary = sanitizeHexColor(awayComp?.team?.color, '#e31837')
  const homeAlt = homeComp?.team?.alternateColor ? sanitizeHexColor(homeComp.team.alternateColor) : undefined
  const awayAlt = awayComp?.team?.alternateColor ? sanitizeHexColor(awayComp.team.alternateColor) : undefined

  // Ensure minimum luminance against dark dashboard backgrounds (#0c121e)
  const adjustColor = (hex: string, fallback: string): string => {
    const [r, g, b] = hexToRgb(hex)
    const [, , l] = rgbToHsl(r, g, b)
    if (l < 15) {
      return fallback
    }
    return hex
  }

  const hPrimary = adjustColor(homePrimary, '#2563eb')
  const aPrimary = adjustColor(awayPrimary, '#dc2626')
  const hAlt = homeAlt ? adjustColor(homeAlt, '#f59e0b') : undefined
  const aAlt = awayAlt ? adjustColor(awayAlt, '#0ea5e9') : undefined

  // 0. If primary colors already have strong contrast, use them directly
  if (!areColorsTooSimilar(hPrimary, aPrimary)) {
    return { homeColor: hPrimary, awayColor: aPrimary }
  }

  // 1. Try Away alternate color against Home primary
  if (aAlt && !areColorsTooSimilar(hPrimary, aAlt)) {
    return { homeColor: hPrimary, awayColor: aAlt }
  }

  // 2. Try Home alternate color against Away primary
  if (hAlt && !areColorsTooSimilar(hAlt, aPrimary)) {
    return { homeColor: hAlt, awayColor: aPrimary }
  }

  // 3. Try both alternate colors against each other
  if (hAlt && aAlt && !areColorsTooSimilar(hAlt, aAlt)) {
    return { homeColor: hAlt, awayColor: aAlt }
  }

  // 4. Fallback: Intelligent curated contrast pair based on color family
  const [h1] = rgbToHsl(...hexToRgb(hPrimary))
  let fallbackPair: { homeColor: string; awayColor: string }

  // If home is in the blue/cyan/cool zone (160 - 260)
  if (h1 >= 160 && h1 <= 260) {
    fallbackPair = { homeColor: hPrimary, awayColor: '#f59e0b' } // Amber/Gold contrast
  } else if (h1 <= 45 || h1 >= 330) {
    // If home is in the red/orange/warm zone (0 - 45 or 330 - 360)
    fallbackPair = { homeColor: hPrimary, awayColor: '#0ea5e9' } // Vibrant Cyan contrast
  } else if (h1 > 45 && h1 < 160) {
    // If home is in the green zone (75 - 159)
    fallbackPair = { homeColor: hPrimary, awayColor: '#f97316' } // Orange contrast
  } else {
    // Purple / violet zone (261 - 329)
    fallbackPair = { homeColor: hPrimary, awayColor: '#ffb81c' } // Gold contrast
  }

  if (!areColorsTooSimilar(fallbackPair.homeColor, fallbackPair.awayColor)) {
    return fallbackPair
  }

  // Ultimate fail-safe high-contrast broadcast pairing
  return { homeColor: '#0ea5e9', awayColor: '#f43f5e' }
}

/**
 * Robustly format American football down and distance situations.
 */
export function formatDownAndDistance(situation?: NFLSituation | null): string {
  if (!situation) return 'Between Plays'

  // Prefer ESPN's direct downDistanceText if valid
  if (situation.downDistanceText && situation.downDistanceText.trim() !== '') {
    return situation.downDistanceText.trim().replace(/\bNE\b/g, 'FNE')
  }

  const { down, distance, possessionText, yardLine } = situation

  if (down === -1) {
    return 'Kickoff / PAT Attempt'
  }

  if (down >= 1 && down <= 4) {
    const downSuffix =
      down === 1 ? '1st' : down === 2 ? '2nd' : down === 3 ? '3rd' : '4th'

    let distText: string
    if (distance === 0 || (typeof yardLine === 'number' && Number.isFinite(yardLine) && yardLine <= distance && distance <= 10)) {
      distText = 'Goal'
    } else if (distance === 1) {
      distText = '1'
    } else {
      distText = distance !== undefined ? String(distance) : '10'
    }

    let result = `${downSuffix} & ${distText}`
    if (possessionText) {
      result += ` at ${possessionText.replace(/\bNE\b/g, 'FNE')}`
    }
    return result
  }

  return (situation.shortDownDistanceText || 'Active Drive').replace(/\bNE\b/g, 'FNE')
}

/**
 * Determine possession team and offensive drive direction.
 */
export function getOffensiveDrive(
  situation: NFLSituation | null | undefined,
  competitors: NFLCompetitor[]
): {
  offensiveTeam: NFLCompetitor | null
  direction: 'right' | 'left'
  isHomePossession: boolean
  isAwayPossession: boolean
} {
  const homeComp = competitors.find((c) => c.homeAway === 'home') || null
  const awayComp = competitors.find((c) => c.homeAway === 'away') || null
  const homeAbbr = homeComp?.team?.abbreviation || 'HOME'
  const awayAbbr = awayComp?.team?.abbreviation || 'AWAY'

  const possessionId = situation?.possession || situation?.lastPlay?.team?.id
  const isHomePossession = Boolean(
    possessionId && (homeComp?.id === possessionId || homeComp?.team?.id === possessionId)
  )
  const isAwayPossession = Boolean(
    possessionId && (awayComp?.id === possessionId || awayComp?.team?.id === possessionId)
  )

  let offensiveTeam = homeComp
  let direction: 'right' | 'left' = 'right'

  if (isHomePossession) {
    offensiveTeam = homeComp
    direction = 'right'
  } else if (isAwayPossession) {
    offensiveTeam = awayComp
    direction = 'left'
  } else if (situation?.possessionText) {
    if (situation.possessionText.includes(homeAbbr) || (homeAbbr === 'FNE' && /\bNE\b/.test(situation.possessionText))) {
      offensiveTeam = homeComp
      direction = 'right'
    } else if (situation.possessionText.includes(awayAbbr) || (awayAbbr === 'FNE' && /\bNE\b/.test(situation.possessionText))) {
      offensiveTeam = awayComp
      direction = 'left'
    }
  }

  return {
    offensiveTeam,
    direction,
    isHomePossession,
    isAwayPossession,
  }
}

/**
 * Rigorously verifies whether a game situation is genuinely in the Red Zone.
 * Rejects stale ESPN API flags during Halftime, Kickoffs, Timeouts, End of Quarters,
 * or when the ball is on the offense's own side of the field.
 */
export function isRedZoneSituation(
  situation: NFLSituation | null | undefined,
  status: NFLStatus | null | undefined,
  competitors: NFLCompetitor[] = []
): boolean {
  if (!situation) return false

  // 1. Must be live in progress and not completed
  if (status?.type?.completed) return false
  const state = status?.type?.state
  if (state && state !== 'in') return false

  // 2. Reject Halftime, End of Period, Overtime intermission, Delays, or 0:00 on the clock
  const statusName = (status?.type?.name || '').toUpperCase()
  if (
    statusName === 'STATUS_HALFTIME' ||
    statusName === 'STATUS_END_PERIOD' ||
    statusName === 'STATUS_FINAL' ||
    statusName === 'STATUS_POSTPONED' ||
    statusName === 'STATUS_DELAYED'
  ) {
    return false
  }

  const detail = (status?.type?.detail || status?.type?.shortDetail || status?.type?.description || '').toLowerCase()
  if (
    detail.includes('half') ||
    detail.includes('end of') ||
    detail.includes('final') ||
    detail.includes('intermission') ||
    detail.includes('delay') ||
    detail.includes('suspended')
  ) {
    return false
  }

  // Clock 0:00 means quarter/half has expired and no scrimmage play is active
  if (typeof status?.clock === 'number' && status.clock === 0) {
    return false
  }

  // 3. Reject dead-ball plays like Kickoffs (down = -1) or PATs
  if (situation.down === undefined || situation.down <= 0) {
    return false
  }

  // 4. Must have a valid yardLine between 1 and 99
  const yardLine = situation.yardLine
  if (typeof yardLine !== 'number' || !Number.isFinite(yardLine) || yardLine <= 0 || yardLine >= 100) {
    return false
  }

  // 5. Must be within 20 yards of the OPPONENT's goal line:
  const { direction, offensiveTeam } = getOffensiveDrive(situation, competitors)

  // In ESPN coordinates (0 = Home Goal, 100 = Away Goal):
  // Driving RIGHT means attacking Away Goal (100) -> Red zone is yardLine 80 to 99
  // Driving LEFT means attacking Home Goal (0) -> Red zone is yardLine 1 to 20
  const isInsideOpponent20 =
    (direction === 'right' && yardLine >= 80 && yardLine < 100) ||
    (direction === 'left' && yardLine <= 20 && yardLine > 0)

  if (isInsideOpponent20) {
    return true
  }

  // Fallback check against possessionText: if ball is at "DEF 18" (opponent territory <= 20)
  if (situation.possessionText && offensiveTeam) {
    const defensiveComp = competitors.find((c) => c.id !== offensiveTeam.id)
    const defAbbr = defensiveComp?.team?.abbreviation
    const matchesDef = defAbbr && (
      situation.possessionText.startsWith(defAbbr) ||
      (defAbbr === 'FNE' && situation.possessionText.startsWith('NE'))
    )
    if (matchesDef) {
      const yardNum = parseInt(situation.possessionText.replace(defAbbr, '').replace('NE', '').trim(), 10)
      if (Number.isFinite(yardNum) && yardNum > 0 && yardNum <= 20) {
        return true
      }
    }
  }

  return false
}

/**
 * Detects whether a game is currently in Halftime intermission.
 * Checks ESPN status names, detail descriptions, quarter/clock combinations,
 * and play-by-play markers.
 */
export function isHalftimeSituation(
  status: NFLStatus | null | undefined,
  situation?: NFLSituation | null | undefined
): boolean {
  if (!status) return false
  if (status.type?.completed) return false

  // 1. Explicit status name from ESPN API
  const statusName = (status.type?.name || '').toUpperCase()
  if (statusName === 'STATUS_HALFTIME') {
    return true
  }

  // 2. Explicit text in detail or description (e.g. "Halftime", "At Halftime", "End of 1st Half")
  const detail = (
    status.type?.detail ||
    status.type?.shortDetail ||
    status.type?.description ||
    ''
  ).toLowerCase()

  if (detail === 'halftime' || detail.startsWith('halftime') || detail.includes('at halftime')) {
    return true
  }
  if (detail.includes('end of 1st half') || detail.includes('end of half')) {
    return true
  }
  if (detail.includes('half') && !detail.includes('1st half') && !detail.includes('2nd half')) {
    return true
  }

  // 3. Game is in progress, 2nd quarter, and clock is 0:00 (period 2 ended, period 3 hasn't begun)
  const isSecondQuarter = status.period === 2
  const isClockZero = status.clock === 0 || status.displayClock === '0:00'
  const isLiveState = status.type?.state === 'in'

  if (isSecondQuarter && isClockZero && isLiveState) {
    return true
  }

  // 4. Play-by-play indicates end of quarter 2 or 1st half while at clock 0:00 or period 2
  if (
    isSecondQuarter &&
    situation?.lastPlay?.text &&
    /end\s+(of\s+)?(quarter\s*2|2nd\s*quarter|1st\s*half|half)/i.test(situation.lastPlay.text)
  ) {
    return true
  }

  return false
}

/**
 * Localizes NFL kickoff dates and times to the browsing user's local timezone.
 * Supports optional timezone override (e.g. for testing or explicit user preference).
 * Guarantees resilience against null, undefined, and invalid ISO timestamps.
 */
export function formatLocalizedKickoff(
  dateVal?: string | Date | null,
  timeZone?: string
): string {
  if (!dateVal) return 'Upcoming'
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
    if (isNaN(d.getTime())) return 'Upcoming'

    const weekdayOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
    }
    if (timeZone) {
      weekdayOptions.timeZone = timeZone
    }

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }
    if (timeZone) {
      timeOptions.timeZone = timeZone
    }

    const weekdayStr = d.toLocaleDateString(undefined, weekdayOptions)
    let timeStr = d.toLocaleTimeString(undefined, timeOptions)
    // Standardize uppercase for AM/PM if present (e.g. "6:00 PM BST" or "1:00 PM EDT")
    timeStr = timeStr.replace(/\b([ap]m)\b/gi, (m) => m.toUpperCase())

    return `${weekdayStr} ${timeStr}`
  } catch {
    return 'Upcoming'
  }
}

// =============================================================================
// NFL Week & Playoff Navigation Utilities
// =============================================================================

export interface PlayoffRound {
  weekNumber: number
  name: string
  shortName: string
  icon: string
  detail: string
}

export const PLAYOFF_ROUNDS: PlayoffRound[] = [
  { weekNumber: 1, name: 'Wild Card Weekend', shortName: 'Wild Card', icon: '🃏', detail: '6 Playoff Games' },
  { weekNumber: 2, name: 'Divisional Round', shortName: 'Divisional', icon: '⚔️', detail: '4 Semifinals' },
  { weekNumber: 3, name: 'Conference Championships', shortName: 'Conf Champ', icon: '🏅', detail: 'AFC & NFC Titles' },
  { weekNumber: 4, name: 'Pro Bowl Games', shortName: 'Pro Bowl', icon: '🌟', detail: 'All-Star Showcase' },
  { weekNumber: 5, name: 'Super Bowl LXI', shortName: 'Super Bowl', icon: '🏆', detail: 'World Championship' },
]

export const REGULAR_SEASON_WEEKS = Array.from({ length: 18 }, (_, i) => i + 1)

/**
 * Returns a human-friendly week title (e.g. "Week 4", "Wild Card Weekend", "Super Bowl LXI").
 */
export function getWeekLabel(seasonType?: number, weekNumber?: number): string {
  const type = seasonType ?? 2
  const num = weekNumber ?? 1

  if (type === 3) {
    const round = PLAYOFF_ROUNDS.find((r) => r.weekNumber === num)
    return round ? round.name : `Playoff Round ${num}`
  }
  if (type === 1) {
    return `Preseason Week ${num}`
  }
  return `Week ${num}`
}

/**
 * Returns a compact badge label (e.g. "W4", "Super Bowl", "Wild Card").
 */
export function getWeekBadgeText(seasonType?: number, weekNumber?: number): string {
  const type = seasonType ?? 2
  const num = weekNumber ?? 1

  if (type === 3) {
    const round = PLAYOFF_ROUNDS.find((r) => r.weekNumber === num)
    return round ? round.shortName : `Playoffs W${num}`
  }
  if (type === 1) {
    return `Pre W${num}`
  }
  return `W${num}`
}

/**
 * Formats full season context subtitle (e.g. "2026 NFL Playoffs • Super Bowl LXI").
 */
export function getSeasonPhaseDescription(
  seasonType?: number,
  year?: number,
  weekNumber?: number
): string {
  const y = year ?? 2026
  const type = seasonType ?? 2
  const num = weekNumber ?? 1

  if (type === 3) {
    const round = PLAYOFF_ROUNDS.find((r) => r.weekNumber === num)
    const roundName = round ? round.name : `Round ${num}`
    return `${y} NFL Playoffs • ${roundName}`
  }
  if (type === 1) {
    return `${y} NFL Preseason • Week ${num}`
  }
  return `${y} Regular Season • Week ${num}`
}

/**
 * Calculates next week in the NFL calendar (smoothly transitioning Week 18 -> Wild Card).
 */
export function getNextWeek(seasonType: number, weekNumber: number): { seasonType: number; weekNumber: number } {
  if (seasonType === 1) {
    if (weekNumber < 3) return { seasonType: 1, weekNumber: weekNumber + 1 }
    return { seasonType: 2, weekNumber: 1 }
  }

  if (seasonType === 2) {
    if (weekNumber < 18) return { seasonType: 2, weekNumber: weekNumber + 1 }
    return { seasonType: 3, weekNumber: 1 } // Enters Wild Card playoffs
  }

  if (seasonType === 3) {
    if (weekNumber < 5) return { seasonType: 3, weekNumber: weekNumber + 1 }
    return { seasonType: 3, weekNumber: 5 } // Super Bowl is final
  }

  return { seasonType: 2, weekNumber: 1 }
}

/**
 * Calculates previous week in the NFL calendar (smoothly transitioning Wild Card -> Week 18).
 */
export function getPrevWeek(seasonType: number, weekNumber: number): { seasonType: number; weekNumber: number } {
  if (seasonType === 3) {
    if (weekNumber > 1) return { seasonType: 3, weekNumber: weekNumber - 1 }
    return { seasonType: 2, weekNumber: 18 } // Back to Week 18
  }

  if (seasonType === 2) {
    if (weekNumber > 1) return { seasonType: 2, weekNumber: weekNumber - 1 }
    return { seasonType: 2, weekNumber: 1 }
  }

  if (seasonType === 1) {
    if (weekNumber > 1) return { seasonType: 1, weekNumber: weekNumber - 1 }
    return { seasonType: 1, weekNumber: 1 }
  }

  return { seasonType: 2, weekNumber: 1 }
}

/**
 * Ensures the abbreviation for New England / Patriots is "FNE" (Fucking New England) and never just "NE".
 */
export function sanitizePatriotsAbbreviation(abbr: string | undefined | null): string {
  if (!abbr || typeof abbr !== 'string') return ''
  const trimmed = abbr.trim()
  if (trimmed.toUpperCase() === 'NE' || trimmed.toUpperCase() === 'FNE') {
    return 'FNE'
  }
  return trimmed
}

/**
 * Ensures any reference to the New England Patriots always uses:
 * - "the Fucking New England Patriots" / "Fucking New England Patriots" (full display name)
 * - "Fucking Patriots" (team name)
 * - "Fucking Pats" (colloquial / abbreviated reference)
 * - "FNE" (team abbreviation for Fucking New England)
 */
export function sanitizePatriotsName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return ''
  if (name.trim() === 'FNE') return 'FNE'
  if (name.trim().toUpperCase() === 'NE') return 'FNE'

  // If already prefixed with Fucking, still make sure any standalone NE abbreviation is converted to FNE
  if (/fucking\s+(new\s+e[nN]gland\s+)?patriots/i.test(name) || /fucking\s+pats/i.test(name)) {
    return name.replace(/\bNE\b/g, 'FNE')
  }

  let result = name.replace(
    /\b(the\s+)?(New\s+E[nN]gland\s+Patriots|Patriots|Pats)\b/gi,
    (match, thePrefix, term) => {
      const lower = term.toLowerCase()
      if (lower.startsWith('new')) {
        const isCapN = term.includes('ENgland')
        const baseName = isCapN ? 'Fucking New ENgland Patriots' : 'Fucking New England Patriots'
        return thePrefix ? `the ${baseName}` : baseName
      }
      if (lower === 'patriots') {
        return thePrefix ? 'the Fucking Patriots' : 'Fucking Patriots'
      }
      if (lower === 'pats') {
        return thePrefix ? 'the Fucking Pats' : 'Fucking Pats'
      }
      return match
    }
  )

  // Also sanitize standalone abbreviation NE -> FNE (e.g. "NE @ MIA" -> "FNE @ MIA", "BUF at NE" -> "BUF at FNE")
  result = result.replace(/\bNE\b/g, 'FNE')

  return result
}

/**
 * Sanitizes all team names, event names, competitor references, and abbreviations in an NFLEvent object
 * to guarantee that the New England Patriots are always referred to as
 * "Fucking New England Patriots", "Fucking Patriots", or "Fucking Pats",
 * and that their abbreviation is ALWAYS "FNE" (Fucking New England) instead of "NE".
 */
export function sanitizePatriotsInEvent<T = any>(event: T): T {
  if (!event || typeof event !== 'object') return event
  const ev = event as any
  if (ev.name) {
    ev.name = sanitizePatriotsName(ev.name)
  }
  if (ev.shortName) {
    ev.shortName = sanitizePatriotsName(ev.shortName)
  }
  if (Array.isArray(ev.competitions)) {
    for (const comp of ev.competitions) {
      if (Array.isArray(comp?.competitors)) {
        for (const competitor of comp.competitors) {
          if (competitor?.team) {
            const t = competitor.team
            if (t.displayName) t.displayName = sanitizePatriotsName(t.displayName)
            if (t.name) t.name = sanitizePatriotsName(t.name)
            if (t.shortDisplayName) t.shortDisplayName = sanitizePatriotsName(t.shortDisplayName)
            if (t.nickname) t.nickname = sanitizePatriotsName(t.nickname)
            if (
              t.abbreviation === 'NE' ||
              t.abbreviation === 'ne' ||
              t.abbreviation === 'FNE' ||
              String(t.id) === '17' ||
              String(t.name || '').includes('Patriots') ||
              String(t.displayName || '').includes('Patriots')
            ) {
              t.abbreviation = 'FNE'
            }
          }
        }
      }
      if (comp?.situation) {
        const sit = comp.situation
        if (sit.possessionText) {
          sit.possessionText = sit.possessionText.replace(/\bNE\b/g, 'FNE')
        }
        if (sit.downDistanceText) {
          sit.downDistanceText = sit.downDistanceText.replace(/\bNE\b/g, 'FNE')
        }
        if (sit.shortDownDistanceText) {
          sit.shortDownDistanceText = sit.shortDownDistanceText.replace(/\bNE\b/g, 'FNE')
        }
        if (sit.lastPlay?.text) {
          sit.lastPlay.text = sanitizePatriotsName(sit.lastPlay.text)
        }
      }
    }
  }
  return ev
}

/**
 * Sanitizes an entire NFLScoreboardData payload.
 */
export function sanitizePatriotsInScoreboardData<T = any>(data: T): T {
  if (!data || typeof data !== 'object') return data
  const d = data as any
  if (Array.isArray(d.events)) {
    for (const event of d.events) {
      sanitizePatriotsInEvent(event)
    }
  }
  return data
}


