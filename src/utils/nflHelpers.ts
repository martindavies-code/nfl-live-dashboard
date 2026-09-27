import type { NFLSituation, NFLCompetitor } from '../types/nfl'

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
    if (distance === 0 || (typeof yardLine === 'number' && yardLine <= distance && distance <= 10)) {
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

  const possessionId = situation?.possession
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
