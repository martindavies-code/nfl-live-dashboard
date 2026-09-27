import type { NFLCompetitor, NFLSituation, NFLStatus, NFLOdds } from '../types/nfl'
import { safeParseInt } from './nflHelpers.ts'

/**
 * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun 7.1.26)
 * Accurate to within 1.5e-7 across all real numbers.
 */
export function normalCdf(z: number): number {
  if (z < -8) return 0
  if (z > 8) return 1
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
 */
function moneylineToImplied(mlStr?: string): number | null {
  if (!mlStr) return null
  const num = parseInt(mlStr.replace('+', ''), 10)
  if (isNaN(num) || num === 0) return null

  if (num < 0) {
    return -num / (-num + 100)
  } else {
    return 100 / (num + 100)
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
  modelSource: 'ESPN FPI' | 'Vegas Moneyline' | 'Vegas Spread' | 'Live Analytic Model' | 'Final'
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
  const homeAbbr = homeCompetitor?.team?.abbreviation || 'HOME'
  const awayAbbr = awayCompetitor?.team?.abbreviation || 'AWAY'
  const homeName = homeCompetitor?.team?.displayName || homeAbbr
  const awayName = awayCompetitor?.team?.displayName || awayAbbr

  // 1. POST-GAME FINAL RESOLUTION
  if (gameState === 'post') {
    if (homeScore > awayScore) {
      return {
        homePct: 100,
        awayPct: 0,
        isHomeFavored: true,
        isAwayFavored: false,
        spreadPct: '100.0',
        favoredName: homeName,
        modelSource: 'Final',
      }
    } else if (awayScore > homeScore) {
      return {
        homePct: 0,
        awayPct: 100,
        isHomeFavored: false,
        isAwayFavored: true,
        spreadPct: '100.0',
        favoredName: awayName,
        modelSource: 'Final',
      }
    } else {
      return {
        homePct: 50,
        awayPct: 50,
        isHomeFavored: false,
        isAwayFavored: false,
        spreadPct: '0.0',
        favoredName: 'Tied',
        modelSource: 'Final',
      }
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

    return {
      homePct,
      awayPct,
      isHomeFavored: isHome,
      isAwayFavored: isAway,
      spreadPct: Math.abs(homePct - awayPct).toFixed(1),
      favoredName: isHome ? homeName : isAway ? awayName : 'Even',
      modelSource: 'ESPN FPI',
    }
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

      return {
        homePct,
        awayPct,
        isHomeFavored: isHome,
        isAwayFavored: isAway,
        spreadPct: Math.abs(homePct - awayPct).toFixed(1),
        favoredName: isHome ? homeName : isAway ? awayName : 'Even',
        modelSource: 'Vegas Moneyline',
      }
    }

    // Attempt B: Point Spread via Normal CDF (NFL σ ≈ 13.45 pts)
    const spreadVal = typeof primaryOdds.spread === 'number' ? primaryOdds.spread : null
    if (spreadVal !== null && Number.isFinite(spreadVal)) {
      // In ESPN odds, spread is negative when home team is favored (e.g. -7.5)
      const expectedMargin = -spreadVal
      const z = expectedMargin / 13.45
      const homeRaw = normalCdf(z) * 100
      const homePct = Math.max(1, Math.min(99, Math.round(homeRaw * 10) / 10))
      const awayPct = Math.round((100 - homePct) * 10) / 10
      const isHome = homePct > awayPct
      const isAway = awayPct > homePct

      return {
        homePct,
        awayPct,
        isHomeFavored: isHome,
        isAwayFavored: isAway,
        spreadPct: Math.abs(homePct - awayPct).toFixed(1),
        favoredName: isHome ? homeName : isAway ? awayName : 'Even',
        modelSource: 'Vegas Spread',
      }
    }
  }

  // 4. IN-GAME HIGH-PRECISION DYNAMIC ANALYTIC MODEL
  // (Used when ESPN probability is unavailable or during simulation mode)
  // Calculates remaining time in regulation (4 quarters x 900s = 3600s)
  const period = status?.period || 1
  const clockSeconds = typeof status?.clock === 'number' ? status.clock : 900
  let secondsRemaining = 3600

  if (period >= 1 && period <= 4) {
    secondsRemaining = Math.max(1, (4 - period) * 900 + clockSeconds)
  } else if (period >= 5) {
    // Overtime
    secondsRemaining = Math.max(1, clockSeconds)
  }

  // Time-adjusted volatility: score variance scales with the square root of time remaining
  const timeRatio = Math.max(0.01, secondsRemaining / 3600)
  const sigmaRemaining = 13.45 * Math.sqrt(timeRatio)

  // Expected Points from field position & possession
  let expectedPointsAdvantage = 0
  if (situation && situation.down !== undefined && situation.down > 0) {
    const yardLine = typeof situation.yardLine === 'number' ? situation.yardLine : 50
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
  if (primaryOdds && typeof primaryOdds.spread === 'number') {
    spreadPrior = -primaryOdds.spread * timeRatio * 0.5
  }

  const rawScoreDiff = homeScore - awayScore
  const effectiveMargin = rawScoreDiff + expectedPointsAdvantage + spreadPrior

  // Compute standard normal deviate
  const zScore = effectiveMargin / Math.max(1.5, sigmaRemaining)
  const calculatedHome = normalCdf(zScore) * 100

  // Apply reasonable bounds for active games
  const homePct = Math.max(0.1, Math.min(99.9, Math.round(calculatedHome * 10) / 10))
  const awayPct = Math.round((100 - homePct) * 10) / 10
  const isHome = homePct > awayPct
  const isAway = awayPct > homePct

  return {
    homePct,
    awayPct,
    isHomeFavored: isHome,
    isAwayFavored: isAway,
    spreadPct: Math.abs(homePct - awayPct).toFixed(1),
    favoredName: isHome ? homeName : isAway ? awayName : 'Even',
    modelSource: 'Live Analytic Model',
  }
}
