import { sanitizePatriotsAbbreviation } from '../utils/nflHelpers.ts'

export interface RegisteredHighlight {
  videoId: string
  title: string
  kickoffUtc?: string
}

/**
 * Authoritative registry of official NFL YouTube game highlight videos.
 * Published directly by the official NFL YouTube channel (@nfl).
 *
 * Key format: `${seasonYear}_${seasonType}_${weekNumber}_${awayAbbr}_${homeAbbr}`
 * where seasonType is 'REG' or 'POST'.
 */
export const HIGHLIGHTS_REGISTRY: Record<string, RegisteredHighlight> = {
  // 2026 Regular Season Week 8 (Verified Official NFL Highlights)
  '2026_REG_8_CAR_GB': {
    videoId: 'L6m1RUIXLB4',
    title: 'Carolina Panthers vs Green Bay Packers Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-10-30T00:15Z',
  },
  '2026_REG_8_BAL_BUF': {
    videoId: '3xMS3qL2KwY',
    title: 'Baltimore Ravens vs Buffalo Bills Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_TEN_CIN': {
    videoId: 'fZ27uy5PB7I',
    title: 'Tennessee Titans vs Cincinnati Bengals Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_ARI_DAL': {
    videoId: '5qorFNyHsiM',
    title: 'Arizona Cardinals vs. Dallas Cowboys Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_MIN_DET': {
    videoId: 'pB59Bt0uklY',
    title: 'Minnesota Vikings vs. Detroit Lions Game Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_LV_NYJ': {
    videoId: '-fuyn2BZZAI',
    title: 'Las Vegas Raiders vs. New York Jets Game Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_CLE_PIT': {
    videoId: '_tkkFK0248w',
    title: 'Cleveland Browns vs. Pittsburgh Steelers Game Highlights | NFL 2026 Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_ATL_TB': {
    videoId: 'lGnOFwQPXD4',
    title: 'Atlanta Falcons vs. Tampa Bay Buccaneers Game Highlights | NFL 2026 Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_IND_JAX': {
    videoId: 'R7zUguz0Aag',
    title: 'Indianapolis Colts vs. Jacksonville Jaguars Game Highlights | NFL 2026 Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_LAC_LAR': {
    videoId: 'Z5w0O7Jprdk',
    title: 'Los Angeles Chargers vs Los Angeles Rams Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T21:05Z',
  },
  '2026_REG_8_KC_DEN': {
    videoId: 'Tj71A_YItgE',
    title: 'Kansas City Chiefs vs. Denver Broncos Game Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T21:25Z',
  },
  '2026_REG_8_NE_MIA': {
    videoId: 'EL_8uTSc1PY',
    title: 'New England Patriots vs Miami Dolphins Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T21:25Z',
  },
  '2026_REG_8_PHI_WSH': {
    videoId: '40wesZPReUc',
    title: 'Philadelphia Eagles vs Washington Commanders Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-02T01:20Z',
  },
  '2026_REG_8_CHI_SEA': {
    videoId: 'j8XRNpYOsos',
    title: 'Chicago Bears vs Seattle Seahawks Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-03T01:15Z',
  },
}

/**
 * Normalizes team abbreviation for registry key lookup.
 * Automatically handles Patriots aliases (FNE -> NE) and upper-casing.
 */
export function normalizeHighlightAbbr(abbr?: string | null): string {
  if (!abbr || typeof abbr !== 'string') return ''
  const clean = abbr.trim().toUpperCase()
  if (clean === 'FNE' || clean === 'PATRIOTS') return 'NE'
  const sanitized = sanitizePatriotsAbbreviation(clean)
  if (sanitized === 'FNE') return 'NE'
  return clean
}

/**
 * Builds the canonical registry key for a given game.
 */
export function buildHighlightKey(
  seasonYear?: number | string | null,
  seasonType?: number | string | null,
  weekNumber?: number | string | null,
  awayAbbr: string = '',
  homeAbbr: string = ''
): string {
  const year = seasonYear ? String(seasonYear).trim() : '2026'
  const typeStr = Number(seasonType) === 3 ? 'POST' : 'REG'
  const week = weekNumber ? String(weekNumber).trim() : '1'
  const away = normalizeHighlightAbbr(awayAbbr)
  const home = normalizeHighlightAbbr(homeAbbr)
  return `${year}_${typeStr}_${week}_${away}_${home}`
}

/**
 * Looks up a registered official highlight video for a game.
 */
export function getRegisteredHighlight(
  seasonYear?: number | string | null,
  seasonType?: number | string | null,
  weekNumber?: number | string | null,
  awayAbbr?: string | null,
  homeAbbr?: string | null
): RegisteredHighlight | null {
  if (!awayAbbr || !homeAbbr) return null
  const key = buildHighlightKey(
    seasonYear ?? 2026,
    seasonType ?? 2,
    weekNumber ?? 1,
    awayAbbr,
    homeAbbr
  )
  return HIGHLIGHTS_REGISTRY[key] || null
}
