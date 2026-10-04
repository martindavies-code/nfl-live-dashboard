// -----------------------------------------------------------------------------
// Scorigami: score combination novelty calculator
//
// A "scorigami" occurs when a final NFL score (winning-losing combination) has
// NEVER appeared before in pro football history. We use the canonical lookup
// table of all 1,097 unique historical scores through 2026 (source: scorigamicenter.com
// & Pro Football Reference) and dynamic programming drive-simulation to:
//   1. Determine whether the current score is already a scorigami.
//   2. Estimate the % chance the game ends on a never-before-seen score.
//   3. Identify the most likely novel score and precisely WHEN / HOW it occurs.
//   4. Provide the exact date, winning team, and losing team when a score last happened.
// -----------------------------------------------------------------------------

import { HISTORICAL_OCCURRED, TOTAL_UNIQUE_SCORIGAMIS, type HistoricalScoreRecord } from './scorigamiHistoricalData.ts'
import { isHalftimeSituation, sanitizePatriotsName } from './nflHelpers.ts'

export interface ScorigamiInfo {
  /** True if the current score pair has never occurred in NFL history */
  isCurrentScorigami: boolean
  /** Formatted probability string e.g. "6.3%", "18.2%", "< 0.1%", "100%" */
  chanceLabel: string
  /** Raw probability 0-1 */
  chancePct: number
  /** The most probable novel score, e.g. "36-23" or "32-22" */
  mostLikelyNovel: string | null
  /** Display label for the most likely novel score */
  mostLikelyLabel: string
  /**
   * Explanation of WHEN / HOW this scorigami occurs:
   * e.g. "Target: 36-23 (Pre-game projection)"
   * or "When score reaches 32-22 (Needs +18 KC, +13 LAC)"
   * or "Current score (25-18) is a Scorigami right now if it holds!"
   * or "Final: Occurred 303x in NFL history (last: Green Bay Packers 20, New York Jets 17 on Sep 20, 2026)"
   */
  whenScenario: string
  /** Total historical occurrences of the current score (0 if never occurred) */
  currentOccurrences: number
  /** Year current score was last seen, or null */
  lastSeenYear: number | null
  /** Formatted date current score was last seen (e.g. "Sep 20, 2026"), or null */
  lastDate: string | null
  /** Raw ISO date current score was last seen (e.g. "2026-09-20"), or null */
  lastDateIso: string | null
  /** Winning team in the last matchup that produced this score, e.g. "Green Bay Packers" */
  lastWinner: string | null
  /** Losing team in the last matchup that produced this score, e.g. "New York Jets" */
  lastLoser: string | null
  /** Formatted summary of the exact last game: "Green Bay Packers 20, New York Jets 17 on Sep 20, 2026" */
  lastGameSummary: string | null
  /** Points needed by home team to reach the most likely novel score */
  pointsNeededHome: number
  /** Points needed by away team to reach the most likely novel score */
  pointsNeededAway: number
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into user-friendly US date ("Sep 20, 2026").
 */
export function formatHistoricalDate(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return isoDate
  }
  const [y, m, d] = parts
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Formats a complete summary of the last historical matchup for a given score:
 * e.g. "Green Bay Packers 20, New York Jets 17 on Sep 20, 2026"
 */
export function formatLastGameSummary(
  scoreKey: string,
  winner?: string | null,
  loser?: string | null,
  isoDate?: string | null
): string | null {
  if (!winner || !loser || !isoDate) return null
  const [hi, lo] = scoreKey.split('-')
  const formattedDate = formatHistoricalDate(isoDate)
  return `${sanitizePatriotsName(winner)} ${hi}, ${sanitizePatriotsName(loser)} ${lo} on ${formattedDate}`
}

/**
 * Creates canonical key "winner-loser" with hi >= lo.
 */
export function makeScoreKey(a: number, b: number): string {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return `${hi}-${lo}`
}

/**
 * Check if a score pair has ever occurred in NFL history.
 */
export function hasOccurred(a: number, b: number): boolean {
  return makeScoreKey(a, b) in HISTORICAL_OCCURRED
}

/**
 * Get historical record [count, lastYear, lastDate, lastWinner, lastLoser] for a score pair, or null if novel.
 */
export function getHistoricalRecord(a: number, b: number): HistoricalScoreRecord | null {
  return HISTORICAL_OCCURRED[makeScoreKey(a, b)] || null
}

/**
 * Accurately derive true regulation seconds remaining in an NFL game.
 * ESPN's `status.clock` gives only the seconds left in the CURRENT period.
 */
export function getGameSecondsRemaining(
  status: any,
  gameState: 'pre' | 'in' | 'post'
): number {
  if (gameState === 'pre') return 3600
  if (gameState === 'post') return 0

  // Halftime intermission always has exactly 2 quarters remaining (1,800 seconds)
  if (isHalftimeSituation(status)) {
    return 1800
  }

  const period = typeof status?.period === 'number' && Number.isFinite(status.period) ? status.period : 1
  const clock = typeof status?.clock === 'number' && Number.isFinite(status.clock) ? status.clock : 900

  // Regulation quarters 1-4 (15 minutes / 900s each)
  if (period >= 1 && period <= 4) {
    const quartersRemaining = 4 - period
    return Math.max(0, quartersRemaining * 900 + clock)
  }

  // Overtime (periods 5+)
  return Math.max(0, clock)
}

// ---------------------------------------------------------------------------
// Empirical NFL drive outcome probabilities (derived from modern NFL drive data):
// 0 pts (Punt/Turnover): 58.6%
// 3 pts (Field Goal): 16.0%
// 6 pts (TD missed PAT): 1.5%
// 7 pts (TD + 1pt PAT): 21.0%
// 8 pts (TD + 2pt conversion): 2.5%
// 2 pts (Safety): 0.4%
// ---------------------------------------------------------------------------
const DRIVE_OUTCOMES = [
  { pts: 0, p: 0.586 },
  { pts: 3, p: 0.160 },
  { pts: 6, p: 0.015 },
  { pts: 7, p: 0.210 },
  { pts: 8, p: 0.025 },
  { pts: 2, p: 0.004 },
] as const

/**
 * Precomputed 1D Dynamic Programming distributions for 0..16 remaining offensive drives.
 * Zero dynamic memory allocations during live game simulation or ticker updates.
 */
const PRECOMPUTED_DRIVE_DISTRIBUTIONS: Float64Array[] = (() => {
  const table: Float64Array[] = []

  // Index 0: 0 additional points with probability 1.0
  const zeroDrives = new Float64Array(100)
  zeroDrives[0] = 1.0
  table.push(zeroDrives)

  let current = new Float64Array(100)
  let next = new Float64Array(100)
  current[0] = 1.0

  for (let d = 1; d <= 16; d++) {
    next.fill(0)
    for (let s = 0; s < 70; s++) {
      const ps = current[s]
      if (ps <= 1e-7) continue
      for (const outcome of DRIVE_OUTCOMES) {
        const target = s + outcome.pts
        if (target < 100) {
          next[target] += ps * outcome.p
        }
      }
    }
    table.push(new Float64Array(next))
    const temp = current
    current = next
    next = temp
  }

  return table
})()

/**
 * 1D Dynamic Programming: Compute the probability distribution of additional points
 * scored over a given number of remaining offensive drives.
 * Returns precomputed distribution array with zero memory allocation.
 * Runs in O(1) constant time.
 */
export function getDrivePointsDistribution(drives: number): Float64Array {
  const numDrives = Math.max(1, Math.min(16, Number.isFinite(drives) ? Math.round(drives) : 1))
  return PRECOMPUTED_DRIVE_DISTRIBUTIONS[numDrives]
}

/**
 * Main export: compute Scorigami statistics for a pre-game, live, or final matchup.
 *
 * @param homeScore Current home score
 * @param awayScore Current away score
 * @param secondsLeft True total seconds remaining in the game
 * @param gameState 'pre' | 'in' | 'post'
 * @param homeAbbr Optional home team abbreviation (e.g. 'KC') for clear scenario text
 * @param awayAbbr Optional away team abbreviation (e.g. 'DET') for clear scenario text
 */
export function getScorigamiInfo(
  homeScore: number,
  awayScore: number,
  secondsLeft: number,
  gameState: 'pre' | 'in' | 'post',
  homeAbbr: string = 'Home',
  awayAbbr: string = 'Away'
): ScorigamiInfo {
  const safeH = Math.max(0, Number.isFinite(homeScore) ? Math.round(homeScore) : 0)
  const safeA = Math.max(0, Number.isFinite(awayScore) ? Math.round(awayScore) : 0)
  const safeSeconds = Number.isFinite(secondsLeft) ? Math.max(0, secondsLeft) : (gameState === 'pre' ? 3600 : 0)

  const key = makeScoreKey(safeH, safeA)
  const histRecord = HISTORICAL_OCCURRED[key]
  const isCurrentScorigami = !histRecord
  const currentOccurrences = histRecord ? histRecord[0] : 0
  const lastSeenYear = histRecord ? histRecord[1] : null
  const lastDateIso = histRecord ? histRecord[2] : null
  const lastDate = lastDateIso ? formatHistoricalDate(lastDateIso) : null
  const lastWinner = histRecord ? sanitizePatriotsName(histRecord[3]) : null
  const lastLoser = histRecord ? sanitizePatriotsName(histRecord[4]) : null
  const lastGameSummary = histRecord
    ? formatLastGameSummary(key, lastWinner, lastLoser, lastDateIso)
    : null

  // 1. Post-game: Game is over, outcome is definitive
  if (gameState === 'post') {
    const chancePct = isCurrentScorigami ? 1 : 0
    return {
      isCurrentScorigami,
      chanceLabel: isCurrentScorigami ? '100% — Historical Scorigami!' : '0% — Already Occurred',
      chancePct,
      mostLikelyNovel: isCurrentScorigami ? key : null,
      mostLikelyLabel: isCurrentScorigami ? `${key} ✨` : key,
      whenScenario: isCurrentScorigami
        ? `Final: Novel score #${TOTAL_UNIQUE_SCORIGAMIS + 1} in NFL history!`
        : `Final: Occurred ${currentOccurrences}x in NFL history (last: ${lastGameSummary || `in ${lastSeenYear}`})`,
      currentOccurrences,
      lastSeenYear,
      lastDate,
      lastDateIso,
      lastWinner,
      lastLoser,
      lastGameSummary,
      pointsNeededHome: 0,
      pointsNeededAway: 0,
    }
  }

  // 2. Pre-game or Live Game: Project future scoring drives using DP convolution
  // An average NFL game has ~11.5 drives per team across 3,600 regulation seconds
  const drivesLeft = gameState === 'pre'
    ? 11.5
    : Math.max(0.5, (safeSeconds / 3600) * 11.5)

  const distH = getDrivePointsDistribution(drivesLeft)
  const distA = getDrivePointsDistribution(drivesLeft)

  let totalProb = 0
  let scorigamiProb = 0
  const candidates: Array<{
    score: string
    finalH: number
    finalA: number
    dh: number
    da: number
    p: number
  }> = []

  const maxPts = Math.min(65, Math.ceil(drivesLeft * 5.5))
  for (let dh = 0; dh < maxPts; dh++) {
    const ph = distH[dh]
    if (ph < 1e-6) continue
    for (let da = 0; da < maxPts; da++) {
      const pa = distA[da]
      if (pa < 1e-6) continue
      const p = ph * pa
      totalProb += p

      const finalH = safeH + dh
      const finalA = safeA + da
      const candKey = makeScoreKey(finalH, finalA)

      if (!HISTORICAL_OCCURRED[candKey]) {
        scorigamiProb += p
        candidates.push({ score: candKey, finalH, finalA, dh, da, p })
      }
    }
  }

  // Sort candidate novel scores by joint probability descending
  candidates.sort((a, b) => b.p - a.p)
  const top = candidates[0] || null

  const normScorigamiChance = totalProb > 0 ? scorigamiProb / totalProb : 0
  const chancePct = Math.round(normScorigamiChance * 1000) / 10
  const chanceLabel = chancePct < 0.1 ? '< 0.1%' : `${chancePct.toFixed(1)}%`

  // Construct precise WHEN / HOW narrative
  let whenScenario = ''
  if (gameState === 'pre') {
    whenScenario = top
      ? `Pre-game projection: Occurs if final score reaches ${top.score}`
      : 'Low pre-game scorigami probability'
  } else if (isCurrentScorigami) {
    if (top && top.dh === 0 && top.da === 0) {
      const nextAlt = candidates.find((c) => c.dh > 0 || c.da > 0)
      whenScenario = nextAlt
        ? `Current score (${key}) is novel if it holds! Next closest: ${nextAlt.score} (Needs +${nextAlt.dh} ${homeAbbr}, +${nextAlt.da} ${awayAbbr})`
        : `Current score (${key}) is a Scorigami right now if score holds!`
    } else if (top) {
      whenScenario = `Current score is novel! Next target: ${top.score} (Needs +${top.dh} ${homeAbbr}, +${top.da} ${awayAbbr})`
    }
  } else if (top) {
    const homeDiff = top.dh > 0 ? `+${top.dh} ${homeAbbr}` : ''
    const awayDiff = top.da > 0 ? `+${top.da} ${awayAbbr}` : ''
    const diffStr = [homeDiff, awayDiff].filter(Boolean).join(', ')
    whenScenario = `When score reaches ${top.score}${diffStr ? ` (Needs: ${diffStr})` : ''}`
  } else {
    whenScenario = 'No realistic Scorigami path remaining in regulation'
  }

  return {
    isCurrentScorigami,
    chanceLabel,
    chancePct: normScorigamiChance,
    mostLikelyNovel: top ? top.score : null,
    mostLikelyLabel: top ? top.score : 'None',
    whenScenario,
    currentOccurrences,
    lastSeenYear,
    lastDate,
    lastDateIso,
    lastWinner,
    lastLoser,
    lastGameSummary,
    pointsNeededHome: top ? top.dh : 0,
    pointsNeededAway: top ? top.da : 0,
  }
}
