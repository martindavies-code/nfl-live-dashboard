import type { NFLEvent } from '../types/nfl'
import { isHalftimeSituation } from './nflHelpers.ts'

/**
 * Consensus NFL Team Power Rankings (1 to 32, 1 = best).
 * Used for dynamic spotlighting of premier matchups.
 */
export const NFL_POWER_RANKINGS: Record<string, number> = {
  KC: 1,
  DET: 2,
  BAL: 3,
  BUF: 4,
  PHI: 5,
  SF: 6,
  GB: 7,
  MIN: 8,
  HOU: 9,
  WSH: 10,
  PIT: 11,
  TB: 12,
  LAC: 13,
  DEN: 14,
  CIN: 15,
  SEA: 16,
  ATL: 17,
  DAL: 18,
  CHI: 19,
  ARI: 20,
  IND: 21,
  LAR: 22,
  MIA: 23,
  NYJ: 24,
  NYG: 25,
  NO: 26,
  JAX: 27,
  CLE: 28,
  LV: 29,
  NE: 30,
  FNE: 30, // Alias for Patriots
  TEN: 31,
  CAR: 32,
}

/**
 * Returns the power ranking (1-32) for a given team abbreviation.
 */
export function getTeamPowerRank(abbr: string = ''): number {
  const clean = (abbr || '').trim().toUpperCase()
  return NFL_POWER_RANKINGS[clean] ?? 20
}

/**
 * Calculates a matchup quality score based on team power rankings.
 * Lower score = higher quality matchup between premier powerhouse teams.
 * e.g., KC (#1) vs BUF (#4) = score 5.01 (Premier matchup!)
 */
export function getMatchupPowerScore(event: NFLEvent): number {
  const comp = event.competitions?.[0]
  const competitors = comp?.competitors || []
  const homeAbbr = competitors.find((c) => c.homeAway === 'home')?.team?.abbreviation || ''
  const awayAbbr = competitors.find((c) => c.homeAway === 'away')?.team?.abbreviation || ''

  const rankHome = getTeamPowerRank(homeAbbr)
  const rankAway = getTeamPowerRank(awayAbbr)

  return rankHome + rankAway + Math.min(rankHome, rankAway) * 0.01
}

/**
 * Resolves the spotlighted game according to rules:
 * 1. NY Giants (NYG) if they are currently live and NOT at halftime.
 * 2. Otherwise: The best matchup by power ranking.
 *    (Prioritizes live active games > live halftime games > upcoming pre-game > completed post-game)
 */
export function getBestMatchupByPowerRanking(events: NFLEvent[]): NFLEvent | null {
  if (!Array.isArray(events) || events.length === 0) return null

  // 1. Check if NYG is currently live and NOT at halftime
  const nygLiveGame = events.find((ev) => {
    const comp = ev.competitions?.[0]
    const competitors = comp?.competitors || []
    const isNyg = competitors.some((c) => c.team?.abbreviation?.toUpperCase() === 'NYG')
    if (!isNyg) return false

    const state = ev.status?.type?.state || comp?.status?.type?.state || 'pre'
    if (state !== 'in') return false

    const isHalftime = isHalftimeSituation(ev.status || comp?.status, comp?.situation)
    return !isHalftime
  })

  if (nygLiveGame) {
    return nygLiveGame
  }

  // 2. Otherwise: Find the best matchup by power ranking.
  // Group games by state so live active games take priority over pregame/postgame
  const liveActiveGames: NFLEvent[] = []
  const liveHalftimeGames: NFLEvent[] = []
  const preGames: NFLEvent[] = []
  const otherGames: NFLEvent[] = []

  for (const ev of events) {
    const comp = ev.competitions?.[0]
    const state = ev.status?.type?.state || comp?.status?.type?.state || 'pre'

    if (state === 'in') {
      const isHalftime = isHalftimeSituation(ev.status || comp?.status, comp?.situation)
      if (isHalftime) {
        liveHalftimeGames.push(ev)
      } else {
        liveActiveGames.push(ev)
      }
    } else if (state === 'pre') {
      preGames.push(ev)
    } else {
      otherGames.push(ev)
    }
  }

  const pool =
    liveActiveGames.length > 0
      ? liveActiveGames
      : liveHalftimeGames.length > 0
      ? liveHalftimeGames
      : preGames.length > 0
      ? preGames
      : otherGames.length > 0
      ? otherGames
      : events

  const sorted = [...pool].sort((a, b) => getMatchupPowerScore(a) - getMatchupPowerScore(b))
  return sorted[0] || events[0]
}
