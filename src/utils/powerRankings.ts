import type { NFLEvent } from '../types/nfl'
import { isHalftimeSituation } from './nflHelpers.ts'
import {
  getTeamPowerRank as getTeamPowerRankFromRegistry,
  getTeamPowerRankDetail,
  getPowerRankTierStyle,
  getLatestPowerRankingsEdition,
  getWeeklyPowerRankingsEdition,
  getAuthoritativePowerRankingsMap,
  NFL_POWER_RANKINGS,
} from '../data/powerRankingsRegistry.ts'

export {
  getTeamPowerRankDetail,
  getPowerRankTierStyle,
  getLatestPowerRankingsEdition,
  getWeeklyPowerRankingsEdition,
  getAuthoritativePowerRankingsMap,
  NFL_POWER_RANKINGS,
}

/**
 * Returns the authoritative power ranking (1-32) for a given team abbreviation.
 * Sourced from published weekly consensus sports editorial editions.
 */
export function getTeamPowerRank(
  abbr: string = '',
  week?: number,
  season: number = 2026
): number {
  return getTeamPowerRankFromRegistry(abbr, week, season)
}

/**
 * Calculates a matchup quality score based on team power rankings.
 * Lower score = higher quality matchup between premier powerhouse teams.
 * e.g., BUF (#1) vs SF (#2) = score 3.01 (Premier matchup!)
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
  shortLabel: string
  isMarquee: boolean
  badgeClass: string
} {
  const avg = (awayRank + homeRank) / 2
  if (awayRank <= 10 && homeRank <= 10) {
    return {
      label: 'Top-10 Heavyweight Clash',
      shortLabel: 'Top-10 Clash',
      isMarquee: true,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    }
  }
  if (awayRank <= 16 && homeRank <= 16) {
    return {
      label: 'Playoff Contender Battle',
      shortLabel: 'Contender Battle',
      isMarquee: true,
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    }
  }
  if (awayRank <= 5 || homeRank <= 5) {
    return {
      label: 'Marquee Powerhouse Matchup',
      shortLabel: 'Marquee Powerhouse',
      isMarquee: true,
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    }
  }
  if (avg <= 16) {
    return {
      label: 'Competitive Showdown',
      shortLabel: 'Showdown',
      isMarquee: false,
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    }
  }
  return {
    label: 'Key Matchup',
    shortLabel: 'Matchup',
    isMarquee: false,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
  }
}
