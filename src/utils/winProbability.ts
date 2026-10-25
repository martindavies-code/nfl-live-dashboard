import type { NFLCompetitor, NFLSituation, NFLStatus, NFLOdds } from '../types/nfl'
import { safeParseInt, isHalftimeSituation, isOvertimeSituation, sanitizePatriotsName, sanitizePatriotsAbbreviation } from './nflHelpers.ts'

/**
 * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun 7.1.26)
 * Accurate to within 1.5e-7 across all real numbers.
 * Hardened against NaN, +Infinity, and -Infinity.
 */
export function normalCdf(z: number): number {
  if (typeof z !== 'number' || isNaN(z)) return 0.5
  if (z === 0) return 0.5
  if (z === Infinity || z > 8) return 1
  if (z === -Infinity || z < -8) return 0
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const prob =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z > 0 ? 1 - prob : prob
}

/**
 * Converts American Moneyline Odds (e.g. -395, +310) to raw implied probability.
 * Clamps inputs to prevent numeric overflows or negative probabilities.
 */
function moneylineToImplied(mlVal?: string | number | null): number | null {
  if (mlVal === undefined || mlVal === null) return null
  const cleanStr = String(mlVal).replace('+', '').trim()
  const num = parseInt(cleanStr, 10)
  if (!Number.isFinite(num) || num === 0) return null

  // Clamp within realistic odds boundaries [-100000, 100000]
  const clamped = Math.max(-100000, Math.min(100000, num))

  if (clamped < 0) {
    return -clamped / (-clamped + 100)
  } else {
    return 100 / (clamped + 100)
  }
}

/**
 * Parsed pre-game betting odds information.
 */
export interface BettingOddsInfo {
  handicap: string | null         // e.g. "CHI -2.5", "NYG -3", "EVEN"
  overUnder: string | null        // e.g. "O/U 48.5"
  overUnderValue: number | null   // e.g. 48.5
  formattedSummary: string | null // e.g. "CHI -2.5 • O/U 48.5"
  provider: string | null         // e.g. "DraftKings"
}

/**
 * Resolves pre-game betting handicap (e.g. "CHI -2.5", "NYG -3", "EVEN") and
 * Over/Under points total (e.g. "O/U 48.5") from official ESPN odds telemetry.
 * Hardened against missing fields, non-primitive values, and sanitizes Patriots to "FNE".
 */
export function getBettingOddsInfo(
  odds?: NFLOdds[] | null,
  homeAbbr: string = 'HOME',
  awayAbbr: string = 'AWAY'
): BettingOddsInfo {
  if (!Array.isArray(odds) || odds.length === 0 || !odds[0] || typeof odds[0] !== 'object') {
    return {
      handicap: null,
      overUnder: null,
      overUnderValue: null,
      formattedSummary: null,
      provider: null,
    }
  }

  const primaryOdds = odds[0]
  let handicap: string | null = null
  let overUnderValue: number | null = null
  let overUnder: string | null = null

  // 1. Resolve Handicap / Spread
  const rawDetails = typeof primaryOdds.details === 'string' ? primaryOdds.details.trim() : ''
  if (rawDetails) {
    const lower = rawDetails.toLowerCase()
    if (lower === 'even' || lower === 'pk' || lower === 'pick' || lower === "pick'em") {
      handicap = 'EVEN'
    } else {
      handicap = sanitizePatriotsName(rawDetails)
    }
  } else if (typeof primaryOdds.spread === 'number' && Number.isFinite(primaryOdds.spread)) {
    const spread = primaryOdds.spread
    if (spread === 0) {
      handicap = 'EVEN'
    } else {
      const spreadAbs = Math.abs(spread)
      const spreadStr = spreadAbs % 1 === 0 ? spreadAbs.toFixed(0) : spreadAbs.toFixed(1)
      if (spread < 0) {
        handicap = `${homeAbbr} -${spreadStr}`
      } else {
        handicap = `${awayAbbr} -${spreadStr}`
      }
    }
  }

  // 2. Resolve Over/Under Points Total
  if (typeof primaryOdds.overUnder === 'number' && Number.isFinite(primaryOdds.overUnder) && primaryOdds.overUnder > 0) {
    overUnderValue = primaryOdds.overUnder
    overUnder = `O/U ${primaryOdds.overUnder}`
  } else if (typeof primaryOdds.overUnder === 'string') {
    const parsed = parseFloat(primaryOdds.overUnder)
    if (Number.isFinite(parsed) && parsed > 0) {
      overUnderValue = parsed
      overUnder = `O/U ${parsed}`
    }
  }

  // 3. Resolve Provider
  const provider = primaryOdds.provider?.name || primaryOdds.provider?.displayName || null

  // 4. Resolve Formatted Summary
  let formattedSummary: string | null = null
  if (handicap && overUnder) {
    if (handicap.toLowerCase().includes('o/u') || handicap.toLowerCase().includes('total')) {
      formattedSummary = handicap
    } else {
      formattedSummary = `${handicap} • ${overUnder}`
    }
  } else if (handicap) {
    formattedSummary = handicap
  } else if (overUnder) {
    formattedSummary = overUnder
  }

  return {
    handicap,
    overUnder,
    overUnderValue,
    formattedSummary,
    provider,
  }
}

/**
 * Result of the high-precision NFL win probability engine.
 */
export interface CalculatedWinProbability {
  homePct: number
  awayPct: number
  isHomeFavored: boolean
  isAwayFavored: boolean
  spreadPct: string // Absolute differential e.g. "35.4"
  favoredName: string
  modelSource: 'ESPN FPI' | 'Vegas Moneyline' | 'Vegas Spread' | 'Pregame Projection' | 'Live Analytic Model' | 'Final'
  handicap?: string | null
  overUnder?: number | null
  overUnderText?: string | null
  formattedOdds?: string | null
}

interface CalculateOptions {
  homeWinPercentage?: number | null
  awayWinPercentage?: number | null
  homeCompetitor: NFLCompetitor
  awayCompetitor: NFLCompetitor
  gameState?: 'pre' | 'in' | 'post'
  status?: NFLStatus
  situation?: NFLSituation | null
  odds?: NFLOdds[]
}

/**
 * Comprehensive NFL Win Probability Engine
 *
 * Combines:
 * 1. Post-game decisive resolution (100% / 0%)
 * 2. Official ESPN in-game FPI (when active in live games)
 * 3. De-vigged Vegas Moneyline / Point Spread market consensus (for upcoming games)
 * 4. Time-decay Brownian motion Expected Points (EPA) model (for live games lacking ESPN data)
 */
export function calculateWinProbability({
  homeWinPercentage,
  awayWinPercentage,
  homeCompetitor,
  awayCompetitor,
  gameState = 'in',
  status,
  situation,
  odds,
}: CalculateOptions): CalculatedWinProbability {
  const homeScore = safeParseInt(homeCompetitor?.score, 0)
  const awayScore = safeParseInt(awayCompetitor?.score, 0)
  const rawHomeAbbr = homeCompetitor?.team?.abbreviation || 'HOME'
  const rawAwayAbbr = awayCompetitor?.team?.abbreviation || 'AWAY'
  const homeAbbr = sanitizePatriotsAbbreviation(rawHomeAbbr) || 'HOME'
  const awayAbbr = sanitizePatriotsAbbreviation(rawAwayAbbr) || 'AWAY'
  const homeName = sanitizePatriotsName(homeCompetitor?.team?.displayName || homeAbbr)
  const awayName = sanitizePatriotsName(awayCompetitor?.team?.displayName || awayAbbr)

  const bettingOdds = getBettingOddsInfo(odds, homeAbbr, awayAbbr)

  const makeResult = (
    homePct: number,
    awayPct: number,
    isHomeFavored: boolean,
    isAwayFavored: boolean,
    spreadPct: string,
    favoredName: string,
    modelSource: CalculatedWinProbability['modelSource']
  ): CalculatedWinProbability => ({
    homePct,
    awayPct,
    isHomeFavored,
    isAwayFavored,
    spreadPct,
    favoredName,
    modelSource,
    handicap: bettingOdds.handicap,
    overUnder: bettingOdds.overUnderValue,
    overUnderText: bettingOdds.overUnder,
    formattedOdds: bettingOdds.formattedSummary,
  })

  // 1. POST-GAME FINAL RESOLUTION
  if (gameState === 'post') {
    if (homeScore > awayScore) {
      return makeResult(100, 0, true, false, '100.0', homeName, 'Final')
    } else if (awayScore > homeScore) {
      return makeResult(0, 100, false, true, '100.0', awayName, 'Final')
    } else {
      return makeResult(50, 50, false, false, '0.0', 'Tied', 'Final')
    }
  }

  // 2. LIVE IN-PROGRESS WITH OFFICIAL ESPN FPI PROBABILITY
  if (gameState === 'in' && typeof homeWinPercentage === 'number' && Number.isFinite(homeWinPercentage)) {
    let rawHome = homeWinPercentage <= 1 ? homeWinPercentage * 100 : homeWinPercentage
    let rawAway: number

    if (typeof awayWinPercentage === 'number' && Number.isFinite(awayWinPercentage)) {
      rawAway = awayWinPercentage <= 1 ? awayWinPercentage * 100 : awayWinPercentage
      // Normalize to sum to 100
      const total = rawHome + rawAway
      if (total > 0 && Math.abs(total - 100) > 0.05) {
        rawHome = (rawHome / total) * 100
        rawAway = 100 - rawHome
      } else {
        rawAway = 100 - rawHome
      }
    } else {
      rawAway = 100 - rawHome
    }

    // Clamp strictly between 0.1% and 99.9% while in progress
    const homePct = Math.max(0.1, Math.min(99.9, Math.round(rawHome * 10) / 10))
    const awayPct = Math.round((100 - homePct) * 10) / 10
    const isHome = homePct > awayPct
    const isAway = awayPct > homePct

    return makeResult(
      homePct,
      awayPct,
      isHome,
      isAway,
      Math.abs(homePct - awayPct).toFixed(1),
      isHome ? homeName : isAway ? awayName : 'Even',
      'ESPN FPI'
    )
  }

  // 3. PRE-GAME MATCHUPS: Vegas Market Consensus (DraftKings / ESPN Bet)
  const primaryOdds = odds?.[0]
  if (gameState === 'pre' && primaryOdds) {
    // Attempt A: De-vigged Moneyline
    const homeMl = primaryOdds.moneyline?.home?.close?.odds || primaryOdds.moneyline?.home?.open?.odds
    const awayMl = primaryOdds.moneyline?.away?.close?.odds || primaryOdds.moneyline?.away?.open?.odds

    const homeImplied = moneylineToImplied(homeMl)
    const awayImplied = moneylineToImplied(awayMl)

    if (homeImplied && awayImplied) {
      const deViggedHome = (homeImplied / (homeImplied + awayImplied)) * 100
      const homePct = Math.max(1, Math.min(99, Math.round(deViggedHome * 10) / 10))
      const awayPct = Math.round((100 - homePct) * 10) / 10
      const isHome = homePct > awayPct
      const isAway = awayPct > homePct

      return makeResult(
        homePct,
        awayPct,
        isHome,
        isAway,
        Math.abs(homePct - awayPct).toFixed(1),
        isHome ? homeName : isAway ? awayName : 'Even',
        'Vegas Moneyline'
      )
    }

    // Attempt B: Point Spread via Normal CDF (NFL σ ≈ 13.45 pts)
    const spreadVal = typeof primaryOdds.spread === 'number' && Number.isFinite(primaryOdds.spread) ? primaryOdds.spread : null
    if (spreadVal !== null) {
      // In ESPN odds, spread is negative when home team is favored (e.g. -7.5)
      const expectedMargin = -spreadVal
      const z = expectedMargin / 13.45
      const homeRaw = normalCdf(z) * 100
      const homePct = Math.max(1, Math.min(99, Math.round((Number.isFinite(homeRaw) ? homeRaw : 50) * 10) / 10))
      const awayPct = Math.round((100 - homePct) * 10) / 10
      const isHome = homePct > awayPct
      const isAway = awayPct > homePct

      return makeResult(
        homePct,
        awayPct,
        isHome,
        isAway,
        Math.abs(homePct - awayPct).toFixed(1),
        isHome ? homeName : isAway ? awayName : 'Even',
        'Vegas Spread'
      )
    }
  }

  // Pre-game fallback when no Vegas odds are available: assign canonical NFL home-field baseline (~53.5% home win expectation)
  if (gameState === 'pre') {
    const homePct = 53.5
    const awayPct = 46.5
    return makeResult(homePct, awayPct, true, false, '7.0', homeName, 'Pregame Projection')
  }

  // 4. IN-GAME HIGH-PRECISION DYNAMIC ANALYTIC MODEL
  // (Used when ESPN probability is unavailable or during simulation mode)
  // Calculates remaining time in regulation (4 quarters x 900s = 3600s)
  const isHalftime = isHalftimeSituation(status, situation)
  let secondsRemaining = 3600

  if (isHalftime) {
    // Halftime intermission always represents exactly 2 regulation quarters remaining
    secondsRemaining = 1800
  } else {
    const period = typeof status?.period === 'number' && Number.isFinite(status.period) ? status.period : 1
    const clockSeconds = typeof status?.clock === 'number' && Number.isFinite(status.clock) ? status.clock : 900

    const isOT = isOvertimeSituation(status)
    if (isOT || period >= 5) {
      // Overtime
      secondsRemaining = Math.max(1, clockSeconds)
    } else if (period >= 1 && period <= 4) {
      secondsRemaining = Math.max(1, (4 - period) * 900 + clockSeconds)
    }
  }

  // Time-adjusted volatility: score variance scales with the square root of time remaining
  const timeRatio = Math.max(0.01, secondsRemaining / 3600)
  const sigmaRemaining = 13.45 * Math.sqrt(timeRatio)

  // Expected Points from field position & possession (inactive at Halftime because 2nd half begins with kickoff)
  let expectedPointsAdvantage = 0
  if (situation && situation.down !== undefined && situation.down > 0 && !isHalftime) {
    const yardLine = typeof situation.yardLine === 'number' && Number.isFinite(situation.yardLine) ? situation.yardLine : 50
    // ESPN coordinates: 0 is Home goal, 100 is Away goal
    const isHomeDriving = situation.possession === homeCompetitor?.id
    const isAwayDriving = situation.possession === awayCompetitor?.id

    // Expected Points curve based on distance to opponent goal
    const yardsToGoal = isHomeDriving ? 100 - yardLine : isAwayDriving ? yardLine : 50
    const driveValue = Math.max(0, 5.5 - yardsToGoal * 0.055) + (situation.isRedZone ? 1.0 : 0)

    if (isHomeDriving) {
      expectedPointsAdvantage = driveValue
    } else if (isAwayDriving) {
      expectedPointsAdvantage = -driveValue
    }
  }

  // Pre-game spread prior decays linearly to 0 by fourth quarter
  let spreadPrior = 0
  if (primaryOdds && typeof primaryOdds.spread === 'number' && Number.isFinite(primaryOdds.spread)) {
    spreadPrior = -primaryOdds.spread * timeRatio * 0.5
  }

  const rawScoreDiff = homeScore - awayScore
  const effectiveMargin = rawScoreDiff + expectedPointsAdvantage + spreadPrior

  // Compute standard normal deviate
  const zScore = effectiveMargin / Math.max(1.5, sigmaRemaining)
  const calculatedHome = normalCdf(Number.isFinite(zScore) ? zScore : 0) * 100
  const safeHome = Number.isFinite(calculatedHome) ? calculatedHome : 50

  // Apply reasonable bounds for active games
  const homePct = Math.max(0.1, Math.min(99.9, Math.round(safeHome * 10) / 10))
  const awayPct = Math.round((100 - homePct) * 10) / 10
  const isHome = homePct > awayPct
  const isAway = awayPct > homePct

  return makeResult(
    homePct,
    awayPct,
    isHome,
    isAway,
    Math.abs(homePct - awayPct).toFixed(1),
    isHome ? homeName : isAway ? awayName : 'Even',
    'Live Analytic Model'
  )
}
