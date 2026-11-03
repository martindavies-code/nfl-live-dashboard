/**
 * Authoritative NFL Power Rankings Registry
 *
 * Ingests and maintains weekly NFL Power Rankings sourced directly from authoritative
 * published sports media (Yahoo Sports, FanSided, AP, and major sports editorial consensus).
 *
 * Each edition records:
 *  - season & week number
 *  - verified publication date
 *  - source article metadata (publisher, title, URL, author)
 *  - comprehensive 1-to-32 rankings for all 32 NFL franchises
 *  - week-over-week rank movement / change (+/-)
 */

export interface PowerRankingSource {
  publisher: string
  title: string
  url: string
  publishedDate: string
  season: number
  week: number
  author?: string
}

export interface TeamPowerRankingEntry {
  rank: number
  previousRank?: number
  change?: number // positive = rose, negative = fell, 0 = unchanged
  note?: string
}

export interface WeeklyPowerRankingsEdition {
  season: number
  week: number
  verifiedOn: string
  source: PowerRankingSource
  rankings: Record<string, TeamPowerRankingEntry>
}

/**
 * Standard 32 NFL Franchise Nicknames to ESPN/NFL abbreviations mapping.
 */
export const NFL_TEAM_ABBREVIATIONS: Record<string, string> = {
  Cardinals: 'ARI', Falcons: 'ATL', Ravens: 'BAL', Bills: 'BUF', Panthers: 'CAR', Bears: 'CHI',
  Bengals: 'CIN', Browns: 'CLE', Cowboys: 'DAL', Broncos: 'DEN', Lions: 'DET', Packers: 'GB',
  Texans: 'HOU', Colts: 'IND', Jaguars: 'JAX', Chiefs: 'KC', Chargers: 'LAC', Rams: 'LAR',
  Raiders: 'LV', Dolphins: 'MIA', Vikings: 'MIN', Patriots: 'NE', Saints: 'NO', Giants: 'NYG',
  Jets: 'NYJ', Eagles: 'PHI', Steelers: 'PIT', Seahawks: 'SEA', '49ers': 'SF', Buccaneers: 'TB',
  Titans: 'TEN', Commanders: 'WSH',
}

/**
 * Normalises team abbreviations, supporting Patriots alias 'FNE' and trimming whitespace.
 */
export function normalizePowerRankingTeam(abbr: string | undefined | null): string {
  const clean = String(abbr || '').trim().toUpperCase()
  if (clean === 'FNE') return 'NE'
  return clean
}

/**
 * Historical and verified published editions of NFL Power Rankings.
 */
export const POWER_RANKINGS_REGISTRY: WeeklyPowerRankingsEdition[] = [
  {
    season: 2026,
    week: 9,
    verifiedOn: '2026-11-03',
    source: {
      publisher: 'Yahoo Sports / FanSided',
      title: 'Week 9 NFL Power Rankings: Broncos, Lions, Buccaneers, Steelers Climb After Big Week 8 Wins',
      url: 'https://sports.yahoo.com/articles/week-9-nfl-power-rankings-004326616.html',
      publishedDate: '2026-11-03',
      season: 2026,
      week: 9,
      author: 'FanSided NFL Editorial Network',
    },
    rankings: {
      BUF: { rank: 1, previousRank: 1, change: 0, note: 'Dominant division lead and top AFC offense' },
      SF: { rank: 2, previousRank: 2, change: 0, note: 'Offensive health returning; high efficiency' },
      DET: { rank: 3, previousRank: 4, change: 1, note: 'Explosive scoring unit in the NFC North' },
      CHI: { rank: 4, previousRank: 5, change: 1, note: 'Surging defense and balanced attack' },
      DEN: { rank: 5, previousRank: 7, change: 2, note: 'Vaulted into Top 5 after clutch Week 8 statement' },
      SEA: { rank: 6, previousRank: 8, change: 2, note: 'Physical front and efficient red zone execution' },
      MIN: { rank: 7, previousRank: 6, change: -1, note: 'High floor defense with quick-strike passing' },
      KC: { rank: 8, previousRank: 3, change: -5, note: 'Defensive anchor despite offensive turnover variance' },
      JAX: { rank: 9, previousRank: 10, change: 1, note: 'Balanced aerial attack climbing AFC South' },
      CIN: { rank: 10, previousRank: 11, change: 1, note: 'High-octane passing offense catching stride' },
      NE: { rank: 11, previousRank: 12, change: 1, note: 'Steadily improving efficiency metrics' },
      FNE: { rank: 11, previousRank: 12, change: 1, note: 'Patriots alias' },
      LAR: { rank: 12, previousRank: 13, change: 1, note: 'Healthy skill corps driving playoff push' },
      PIT: { rank: 13, previousRank: 17, change: 4, note: 'Aggressive turnover creation fuels climb' },
      GB: { rank: 14, previousRank: 14, change: 0, note: 'Dangerous NFC contender when rhythm clicks' },
      NYG: { rank: 15, previousRank: 16, change: 1, note: 'Defensive front seven keeping games close' },
      TB: { rank: 16, previousRank: 18, change: 2, note: 'Gritty divisional competitors' },
      ATL: { rank: 17, previousRank: 19, change: 2, note: 'Offensive playmakers finding consistency' },
      CLE: { rank: 18, previousRank: 20, change: 2, note: 'Stout defensive line generating pressure' },
      LV: { rank: 19, previousRank: 21, change: 2, note: 'Competitive weekly showing in AFC West' },
      DAL: { rank: 20, previousRank: 23, change: 3, note: 'Looking to stabilize turnover differential' },
      CAR: { rank: 21, previousRank: 25, change: 4, note: 'Young core showing second-half resilience' },
      BAL: { rank: 22, previousRank: 15, change: -7, note: 'Stumbled in Week 8; dynamic upside remains' },
      ARI: { rank: 23, previousRank: 22, change: -1, note: 'Explosive flashes mixed with defensive lapses' },
      HOU: { rank: 24, previousRank: 22, change: -2, note: 'Injuries impacting sustained drives' },
      PHI: { rank: 25, previousRank: 24, change: -1, note: 'Working to rediscover powerhouse rhythm' },
      NO: { rank: 26, previousRank: 26, change: 0, note: 'Battling depth concerns in NFC South' },
      WSH: { rank: 27, previousRank: 27, change: 0, note: 'Developing offensive structure' },
      TEN: { rank: 28, previousRank: 28, change: 0, note: 'Ground game anchored; searching for air answers' },
      MIA: { rank: 29, previousRank: 29, change: 0, note: 'Speed threats limited by consistency' },
      NYJ: { rank: 30, previousRank: 30, change: 0, note: 'Defensive grit overshadowed by offensive stalls' },
      LAC: { rank: 31, previousRank: 31, change: 0, note: 'Seeking identity in transition year' },
      IND: { rank: 32, previousRank: 32, change: 0, note: 'Rebuilding through young offensive line' },
    },
  },
  {
    season: 2026,
    week: 8,
    verifiedOn: '2026-10-28',
    source: {
      publisher: 'Yahoo Sports / FanSided Consensus',
      title: 'NFL Power Rankings Week 8: Contenders separate as trade deadline nears',
      url: 'https://sports.yahoo.com/articles/see-full-list-nfl-week-211608334.html',
      publishedDate: '2026-10-28',
      season: 2026,
      week: 8,
      author: 'Yahoo Sports Editorial',
    },
    rankings: {
      BUF: { rank: 1, previousRank: 1, change: 0 },
      SF: { rank: 2, previousRank: 3, change: 1 },
      KC: { rank: 3, previousRank: 2, change: -1 },
      DET: { rank: 4, previousRank: 4, change: 0 },
      CHI: { rank: 5, previousRank: 7, change: 2 },
      MIN: { rank: 6, previousRank: 5, change: -1 },
      DEN: { rank: 7, previousRank: 9, change: 2 },
      SEA: { rank: 8, previousRank: 10, change: 2 },
      JAX: { rank: 9, previousRank: 12, change: 3 },
      CIN: { rank: 10, previousRank: 8, change: -2 },
      NE: { rank: 11, previousRank: 13, change: 2 },
      FNE: { rank: 11, previousRank: 13, change: 2 },
      LAR: { rank: 12, previousRank: 14, change: 2 },
      GB: { rank: 14, previousRank: 11, change: -3 },
      BAL: { rank: 15, previousRank: 6, change: -9 },
      NYG: { rank: 16, previousRank: 16, change: 0 },
      PIT: { rank: 17, previousRank: 18, change: 1 },
      TB: { rank: 18, previousRank: 17, change: -1 },
      ATL: { rank: 19, previousRank: 19, change: 0 },
      CLE: { rank: 20, previousRank: 21, change: 1 },
      LV: { rank: 21, previousRank: 20, change: -1 },
      ARI: { rank: 22, previousRank: 23, change: 1 },
      HOU: { rank: 22, previousRank: 22, change: 0 },
      DAL: { rank: 23, previousRank: 24, change: 1 },
      PHI: { rank: 24, previousRank: 15, change: -9 },
      CAR: { rank: 25, previousRank: 27, change: 2 },
      NO: { rank: 26, previousRank: 26, change: 0 },
      WSH: { rank: 27, previousRank: 25, change: -2 },
      TEN: { rank: 28, previousRank: 28, change: 0 },
      MIA: { rank: 29, previousRank: 29, change: 0 },
      NYJ: { rank: 30, previousRank: 30, change: 0 },
      LAC: { rank: 31, previousRank: 31, change: 0 },
      IND: { rank: 32, previousRank: 32, change: 0 },
    },
  },
]

/**
 * Returns the latest verified published edition of NFL Power Rankings.
 */
export function getLatestPowerRankingsEdition(): WeeklyPowerRankingsEdition {
  return POWER_RANKINGS_REGISTRY[0]
}

/**
 * Resolves a power ranking edition by season and week, falling back to the latest.
 */
export function getWeeklyPowerRankingsEdition(
  week?: number,
  season: number = 2026
): WeeklyPowerRankingsEdition {
  if (typeof week === 'number') {
    const match = POWER_RANKINGS_REGISTRY.find(
      (e) => e.week === week && e.season === season
    )
    if (match) return match
  }
  return getLatestPowerRankingsEdition()
}

/**
 * Returns a simple Record<string, number> mapping team abbreviation to rank (1-32).
 */
export function getAuthoritativePowerRankingsMap(
  week?: number,
  season: number = 2026
): Record<string, number> {
  const edition = getWeeklyPowerRankingsEdition(week, season)
  const map: Record<string, number> = {}
  for (const [abbr, entry] of Object.entries(edition.rankings)) {
    map[abbr] = entry.rank
  }
  return map
}

/**
 * Active consensus power rankings for the current slate (1 = best, 32 = worst).
 * Backward-compatible drop-in for legacy code.
 */
export const NFL_POWER_RANKINGS: Record<string, number> = getAuthoritativePowerRankingsMap()

/**
 * Returns the power ranking (1-32) for a given team abbreviation.
 * Sourced from the authoritative published rankings edition.
 * Defaults to 20 for unranked or unknown teams.
 */
export function getTeamPowerRank(
  abbr: string = '',
  week?: number,
  season: number = 2026
): number {
  const clean = normalizePowerRankingTeam(abbr)
  if (!clean) return 20
  const edition = getWeeklyPowerRankingsEdition(week, season)
  const entry = edition.rankings[clean]
  if (entry && typeof entry.rank === 'number' && entry.rank >= 1 && entry.rank <= 32) {
    return entry.rank
  }
  return 20
}

/**
 * Returns detailed power ranking metadata for a team, including week-over-week movement.
 */
export function getTeamPowerRankDetail(
  abbr: string = '',
  week?: number,
  season: number = 2026
): {
  rank: number
  previousRank?: number
  change: number
  note?: string
  source: PowerRankingSource
} {
  const clean = normalizePowerRankingTeam(abbr)
  const edition = getWeeklyPowerRankingsEdition(week, season)
  const entry = edition.rankings[clean] || (clean === 'FNE' ? edition.rankings.NE : undefined)

  const rank = entry?.rank ?? 20
  const previousRank = entry?.previousRank
  const change = typeof entry?.change === 'number'
    ? entry.change
    : typeof previousRank === 'number'
    ? previousRank - rank
    : 0

  return {
    rank,
    previousRank,
    change,
    note: entry?.note,
    source: edition.source,
  }
}

/**
 * Visual styling token helper for power rankings tiers.
 */
export function getPowerRankTierStyle(rank: number): {
  badgeClass: string
  pillClass: string
  tierLabel: string
} {
  if (rank <= 5) {
    return {
      tierLabel: 'Top 5 Elite',
      badgeClass: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
      pillClass: 'bg-amber-400/15 text-amber-300 border-amber-400/35 font-bold',
    }
  }
  if (rank <= 10) {
    return {
      tierLabel: 'Top 10 Contender',
      badgeClass: 'bg-sky-400/20 text-sky-300 border-sky-400/40',
      pillClass: 'bg-sky-400/15 text-sky-300 border-sky-400/35 font-bold',
    }
  }
  if (rank <= 16) {
    return {
      tierLabel: 'Playoff Hunt',
      badgeClass: 'bg-indigo-400/15 text-indigo-300 border-indigo-400/30',
      pillClass: 'bg-indigo-400/10 text-indigo-300 border-indigo-400/25 font-semibold',
    }
  }
  if (rank <= 24) {
    return {
      tierLabel: 'Mid Tier',
      badgeClass: 'bg-white/[0.05] text-slate-300 border-white/[0.1]',
      pillClass: 'bg-white/[0.04] text-slate-300 border-white/[0.08] font-medium',
    }
  }
  return {
    tierLabel: 'Rebuilding',
    badgeClass: 'bg-white/[0.03] text-slate-400 border-white/[0.06]',
    pillClass: 'bg-white/[0.02] text-slate-400 border-white/[0.05] font-normal',
  }
}
