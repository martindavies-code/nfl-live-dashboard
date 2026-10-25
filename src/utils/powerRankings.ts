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
 * Extracts the kickoff timestamp in milliseconds from an NFLEvent.
 */
export function getEventKickoffMs(ev: NFLEvent): number {
  const comp = ev.competitions?.[0]
  const rawDate = ev.date || comp?.date
  if (!rawDate) return Infinity
  const ms = new Date(rawDate).getTime()
  return Number.isNaN(ms) ? Infinity : ms
}

/**
 * Resolves the spotlighted game according to rules:
 * 1. NY Giants (NYG) if they are currently live and NOT at halftime.
 * 2. If there are other games currently in progress:
 *    Default to the best live matchup by power ranking (two highest ranked live teams).
 * 3. If there are NO current games in progress:
 *    Default to the next game to take place (earliest kickoff time).
 *    If several games are scheduled to take place at the same time next,
 *    default to the two highest ranked teams (best matchup by power ranking).
 * 4. If all games in the slate have completed:
 *    Default to the best matchup by power ranking.
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

  // 2. Group games by state
  const liveActiveGames: NFLEvent[] = []
  const liveHalftimeGames: NFLEvent[] = []
  const preGames: NFLEvent[] = []
  const postGames: NFLEvent[] = []

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
    } else if (state === 'post') {
      postGames.push(ev)
    }
  }

  // 3. If games are currently in progress, spotlight the highest ranked live matchup
  if (liveActiveGames.length > 0) {
    const sorted = [...liveActiveGames].sort((a, b) => getMatchupPowerScore(a) - getMatchupPowerScore(b))
    return sorted[0]
  }

  if (liveHalftimeGames.length > 0) {
    const sorted = [...liveHalftimeGames].sort((a, b) => getMatchupPowerScore(a) - getMatchupPowerScore(b))
    return sorted[0]
  }

  // 4. If no current games in progress, default to the next game to take place (earliest kickoff time)
  if (preGames.length > 0) {
    const earliestKickoff = Math.min(...preGames.map(getEventKickoffMs))

    // If several games are scheduled to take place at the same time next (within 15 minutes window):
    const nextGamesToTakePlace = Number.isFinite(earliestKickoff)
      ? preGames.filter((ev) => {
          const time = getEventKickoffMs(ev)
          return Math.abs(time - earliestKickoff) <= 15 * 60 * 1000
        })
      : [...preGames]

    // Sort among the next games by power ranking (two highest ranked teams)
    nextGamesToTakePlace.sort((a, b) => getMatchupPowerScore(a) - getMatchupPowerScore(b))
    return nextGamesToTakePlace[0]
  }

  // 5. If all games in the slate have completed, spotlight the best matchup by power ranking
  if (postGames.length > 0) {
    const sorted = [...postGames].sort((a, b) => getMatchupPowerScore(a) - getMatchupPowerScore(b))
    return sorted[0]
  }

  return events[0]
}

/**
 * Resolves qualitative matchup stature label and badge styling from team power rankings.
 */
export function getMatchupTierInfo(
  awayRank: number,
  homeRank: number
): {
  label: string
  isMarquee: boolean
  badgeClass: string
} {
  const avg = (awayRank + homeRank) / 2
  if (awayRank <= 10 && homeRank <= 10) {
    return {
      label: 'Top-10 Heavyweight Clash',
      isMarquee: true,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    }
  }
  if (awayRank <= 16 && homeRank <= 16) {
    return {
      label: 'Playoff Contender Battle',
      isMarquee: true,
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    }
  }
  if (awayRank <= 5 || homeRank <= 5) {
    return {
      label: 'Marquee Powerhouse Matchup',
      isMarquee: true,
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    }
  }
  if (avg <= 16) {
    return {
      label: 'Competitive Showdown',
      isMarquee: false,
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    }
  }
  return {
    label: 'Key Matchup',
    isMarquee: false,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
  }
}
