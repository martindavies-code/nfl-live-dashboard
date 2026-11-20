import React, { memo } from 'react'
import type { NFLCompetitor, NFLSituation, NFLStatus, NFLOdds } from '../types/nfl'
import { resolveContrastingTeamColors, sanitizePatriotsAbbreviation, isDarkLogoTeam } from '../utils/nflHelpers'
import { calculateWinProbability } from '../utils/winProbability'
import { Activity, Scale, TrendingUp } from 'lucide-react'

interface WinProbabilityBarProps {
  homeWinPercentage?: number | null
  awayWinPercentage?: number | null
  homeCompetitor?: NFLCompetitor | null
  awayCompetitor?: NFLCompetitor | null
  gameState?: 'pre' | 'in' | 'post'
  status?: NFLStatus
  situation?: NFLSituation | null
  odds?: NFLOdds[]
  compact?: boolean
  bare?: boolean
}

const DEFAULT_HOME_COMP: NFLCompetitor = {
  id: 'home',
  homeAway: 'home',
  score: '0',
  team: { id: 'home', name: 'Home', displayName: 'Home Team', abbreviation: 'HOME', color: '1e3a8a', logo: '' },
}

const DEFAULT_AWAY_COMP: NFLCompetitor = {
  id: 'away',
  homeAway: 'away',
  score: '0',
  team: { id: 'away', name: 'Away', displayName: 'Away Team', abbreviation: 'AWAY', color: 'b91c1c', logo: '' },
}

export const WinProbabilityBar: React.FC<WinProbabilityBarProps> = memo(({
  homeWinPercentage,
  awayWinPercentage,
  homeCompetitor,
  awayCompetitor,
  gameState = 'in',
  status,
  situation,
  odds,
  compact = false,
  bare = false,
}) => {
  const safeHomeComp = homeCompetitor || DEFAULT_HOME_COMP
  const safeAwayComp = awayCompetitor || DEFAULT_AWAY_COMP

  // Intelligently resolve team colors so both sides ALWAYS have sharp contrast
  const { homeColor, awayColor } = resolveContrastingTeamColors(safeHomeComp, safeAwayComp)

  const homeAbbr = sanitizePatriotsAbbreviation(safeHomeComp?.team?.abbreviation) || 'HOME'
  const awayAbbr = sanitizePatriotsAbbreviation(safeAwayComp?.team?.abbreviation) || 'AWAY'

  const {
    homePct,
    awayPct,
    isHomeFavored,
    isAwayFavored,
    favoredName,
    modelSource,
    provider,
    handicap,
    overUnder,
    overUnderText,
    formattedOdds,
  } = calculateWinProbability({
    homeWinPercentage,
    awayWinPercentage,
    homeCompetitor: safeHomeComp,
    awayCompetitor: safeAwayComp,
    gameState,
    status,
    situation,
    odds,
  })

  const favoredAbbr = isHomeFavored ? homeAbbr : isAwayFavored ? awayAbbr : 'Even'

  // Truthful, human-readable provenance for the displayed probability
  const methodLabel = (() => {
    switch (modelSource) {
      case 'Vegas Moneyline':
        return `${provider || 'Sportsbook'} moneyline · margin removed`
      case 'Vegas Spread':
        return `${provider || 'Sportsbook'} spread estimate`
      case 'Pregame Projection':
        return 'No odds yet · home-field baseline'
      case 'ESPN FPI':
        return 'ESPN FPI live probability'
      case 'Live Analytic Model':
        return 'Live analytic model'
      default:
        return modelSource
    }
  })()

  const methodTitle = (() => {
    switch (modelSource) {
      case 'Vegas Moneyline':
        return `Chance to win derived from the ${provider || 'listed sportsbook'} moneyline with the bookmaker margin (vig) removed. Odds come via the ESPN feed, which does not publish an odds timestamp.`
      case 'Vegas Spread':
        return `Chance to win estimated from the ${provider || 'listed sportsbook'} point spread using a normal margin model. Odds via the ESPN feed.`
      case 'Pregame Projection':
        return 'No market odds are available yet, so the card shows the league-average home-field baseline (53.5%).'
      case 'ESPN FPI':
        return 'Live in-game win probability from the ESPN feed (FPI).'
      case 'Live Analytic Model':
        return 'Live estimate from score, clock, field position and the pre-game spread, used when ESPN probability is unavailable.'
      default:
        return modelSource
    }
  })()

  if (compact) {
    return (
      <div
        className="w-full select-none"
        aria-label={`Win probability: ${awayAbbr} ${awayPct.toFixed(1)}%, ${homeAbbr} ${homePct.toFixed(1)}%`}
      >
        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0 ring-1 ring-white/30"
              style={{ backgroundColor: awayColor }}
            />
            <span className="text-white font-semibold">{awayAbbr}</span>
            <span
              className="tabular-nums font-bold"
              style={{ color: isAwayFavored ? '#38bdf8' : '#cbd5e1' }}
            >
              {awayPct.toFixed(1)}%
            </span>
          </div>

          <span className="text-xs font-sans font-bold text-slate-400 uppercase tracking-wider">
            WIN PROB
          </span>

          <div className="flex items-center gap-1.5">
            <span
              className="tabular-nums font-bold"
              style={{ color: isHomeFavored ? '#38bdf8' : '#cbd5e1' }}
            >
              {homePct.toFixed(1)}%
            </span>
            <span className="text-white font-semibold">{homeAbbr}</span>
            <span
              className="h-2 w-2 rounded-full shrink-0 ring-1 ring-white/30"
              style={{ backgroundColor: homeColor }}
            />
          </div>
        </div>

        {/* Crisp dual-segment progress track (away left, home right: same order as the matchup rows) */}
        <div className="relative h-2 w-full rounded-full bg-slate-900/90 overflow-hidden flex ring-1 ring-white/[0.08]">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${awayPct}%`, backgroundColor: awayColor }}
          />
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${homePct}%`, backgroundColor: homeColor }}
          />
          {/* 50% baseline center tick */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/40 pointer-events-none" />
        </div>

        {/* Compact pre-game handicap and total strip if available */}
        {formattedOdds && (
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5 px-0.5 tabular-nums">
            <span className="text-slate-300 font-semibold">{handicap || ''}</span>
            <span className="text-slate-400">{overUnderText || ''}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`w-full select-none ${
        bare ? 'p-0' : 'rounded-xl border border-white/[0.08] bg-[#090e18] p-3.5 shadow-sm'
      }`}
      aria-label={`Win probability: ${awayAbbr} ${awayPct.toFixed(1)}%, ${homeAbbr} ${homePct.toFixed(1)}% (${modelSource})`}
    >
      {/* High-Impact Broadcast Dual Header (away left, home right: same order as the matchup rows) */}
      <div className="mb-2 flex items-center justify-between gap-1 sm:gap-2">
        {/* Away Team Probability Capsule */}
        <div className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 transition-all ${
          isAwayFavored
            ? 'bg-white/[0.06] border border-white/[0.12] shadow-sm'
            : 'bg-transparent'
        }`}>
          <div className="relative flex items-center gap-1 sm:gap-1.5 shrink-0">
            {safeAwayComp.team?.logo ? (
              <img
                src={safeAwayComp.team.logo}
                alt=""
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain ${
                  isDarkLogoTeam(safeAwayComp.team?.abbreviation, safeAwayComp.team?.displayName)
                    ? 'team-logo-dark-outline-sm'
                    : 'filter drop-shadow-sm'
                } shrink-0 inline-block`}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30 shrink-0 shadow-sm"
                style={{ backgroundColor: awayColor }}
              />
            )}
            <span className="font-extrabold text-xs text-white tracking-wide leading-tight">
              {awayAbbr}
            </span>
          </div>
          <span
            className="text-xs sm:text-sm md:text-base font-bold tracking-tight tabular-nums ml-0.5"
            style={{ color: isAwayFavored ? '#f43f5e' : '#e2e8f0' }}
          >
            {awayPct.toFixed(1)}%
          </span>
        </div>

        {/* Center Win Probability Pill */}
        <div className="flex flex-col items-center shrink-0 px-0.5 sm:px-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Activity className="h-3 w-3 text-sky-400 hidden xs:inline" />
            WIN PROB
          </span>
        </div>

        {/* Home Team Probability Capsule */}
        <div className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 transition-all ${
          isHomeFavored
            ? 'bg-white/[0.06] border border-white/[0.12] shadow-sm'
            : 'bg-transparent'
        }`}>
          <span
            className="text-xs sm:text-sm md:text-base font-bold tracking-tight tabular-nums mr-0.5"
            style={{ color: isHomeFavored ? '#38bdf8' : '#e2e8f0' }}
          >
            {homePct.toFixed(1)}%
          </span>
          <div className="relative flex items-center gap-1 sm:gap-1.5 shrink-0">
            <span className="font-extrabold text-xs text-white tracking-wide leading-tight">
              {homeAbbr}
            </span>
            {safeHomeComp.team?.logo ? (
              <img
                src={safeHomeComp.team.logo}
                alt=""
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain ${
                  isDarkLogoTeam(safeHomeComp.team?.abbreviation, safeHomeComp.team?.displayName)
                    ? 'team-logo-dark-outline-sm'
                    : 'filter drop-shadow-sm'
                } shrink-0 inline-block`}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30 shrink-0 shadow-sm"
                style={{ backgroundColor: homeColor }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Visual Dual-Colored Split Bar with High Contrast, Textural Hatching & WAI-ARIA Meter Semantics */}
      <div
        className="relative h-4 w-full overflow-hidden rounded-full bg-[#05080f] p-0.5 border border-white/[0.12] shadow-inner"
        role="meter"
        aria-valuenow={Math.round(awayPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Win probability meter: ${awayAbbr} vs ${homeAbbr}`}
        aria-valuetext={`${awayAbbr} ${awayPct.toFixed(1)}%, ${homeAbbr} ${homePct.toFixed(1)}%. ${isAwayFavored ? `${awayAbbr} favored` : isHomeFavored ? `${homeAbbr} favored` : 'Even matchup'}`}
      >
        <div className="flex h-full w-full rounded-full overflow-hidden">
          {/* Away Segment (left) with Color-Blind Stipple Texture */}
          <div
            className="h-full transition-all duration-700 ease-out relative"
            style={{
              width: `${awayPct}%`,
              background: `linear-gradient(90deg, ${awayColor}, ${awayColor}ee)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                backgroundSize: '6px 6px',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </div>

          {/* Home Segment (right) with Color-Blind Diagonal Textural Hatch */}
          <div
            className="h-full transition-all duration-700 ease-out relative"
            style={{
              width: `${homePct}%`,
              background: `linear-gradient(90deg, ${homeColor}ee, ${homeColor})`,
            }}
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 7px)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </div>
        </div>

        {/* 50% Center Baseline Tick & Marker */}
        <div
          className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/60 shadow-sm pointer-events-none"
          title="50% Even Baseline"
        />

        {/* Dynamic Glowing Needlesplit at exact probability boundary */}
        <div
          className="absolute top-0 bottom-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-700 ease-out pointer-events-none"
          style={{ left: `${awayPct}%` }}
        />
      </div>

      {/* Pre-Game Betting Handicap / Over-Under or Projected Insight Strip */}
      <div className="mt-2 flex items-center justify-between gap-1.5 text-xs text-slate-300 border-t border-white/[0.06] pt-1.5">
        <div className="truncate min-w-0 mr-1 flex items-center gap-1.5">
          {formattedOdds ? (
            <span className="flex items-center gap-1.5 truncate text-xs" title={`Pre-Game Betting Odds: ${formattedOdds}`}>
              <Scale className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              {handicap && (
                <span className="inline-flex items-center gap-1 shrink-0">
                  <span className="text-slate-400 font-medium hidden xs:inline">Line</span>
                  <strong className="font-mono font-bold text-white tracking-wide">
                    {handicap}
                  </strong>
                </span>
              )}
              {handicap && overUnder && (
                <span className="text-slate-500 font-bold shrink-0">•</span>
              )}
              {overUnder && (
                <span className="inline-flex items-center gap-1 shrink-0">
                  <span className="text-slate-400 font-medium hidden xs:inline">Total</span>
                  <strong className="font-mono font-bold text-slate-200 tracking-wide">
                    {overUnderText || `O/U ${overUnder}`}
                  </strong>
                </span>
              )}
            </span>
          ) : isHomeFavored || isAwayFavored ? (
            <span className="flex items-center gap-1 truncate text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400 font-medium shrink-0">
                {gameState === 'post' ? 'Result:' : 'Projected:'}
              </span>
              <strong className="text-white font-bold truncate">
                <span className="hidden sm:inline">{favoredName}</span>
                <span className="sm:hidden">{favoredAbbr}</span>
              </strong>
            </span>
          ) : (
            <span className="text-slate-400 font-medium truncate text-xs">Even matchup (50/50)</span>
          )}
        </div>
        <span
          className="text-xs font-semibold text-slate-400 shrink-0 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]"
          title={methodTitle}
        >
          {methodLabel}
        </span>
      </div>

      {(modelSource === 'Vegas Moneyline' || modelSource === 'Vegas Spread') && (
        <div className="mt-1 text-[10px] leading-tight text-slate-500">
          Odds via the ESPN feed, which publishes no as-of timestamp.
        </div>
      )}
    </div>
  )
})
