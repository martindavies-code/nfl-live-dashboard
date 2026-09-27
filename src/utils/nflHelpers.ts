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
 * Robustly format American football down and distance situations.
 */
export function formatDownAndDistance(situation?: NFLSituation | null): string {
  if (!situation) return 'Between Plays'

  // Prefer ESPN's direct downDistanceText if valid
  if (situation.downDistanceText && situation.downDistanceText.trim() !== '') {
    return situation.downDistanceText.trim()
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
      result += ` at ${possessionText}`
    }
    return result
  }

  return situation.shortDownDistanceText || 'Active Drive'
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
    if (situation.possessionText.includes(homeAbbr)) {
      offensiveTeam = homeComp
      direction = 'right'
    } else if (situation.possessionText.includes(awayAbbr)) {
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
    if (defAbbr && situation.possessionText.startsWith(defAbbr)) {
      const yardNum = parseInt(situation.possessionText.replace(defAbbr, '').trim(), 10)
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

