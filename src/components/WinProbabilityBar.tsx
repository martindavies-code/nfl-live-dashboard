import React, { memo } from 'react'
import type { NFLCompetitor, NFLSituation, NFLStatus, NFLOdds } from '../types/nfl'
import { resolveContrastingTeamColors, sanitizePatriotsAbbreviation } from '../utils/nflHelpers'
import { calculateWinProbability } from '../utils/winProbability'
import { Activity, TrendingUp } from 'lucide-react'

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
    spreadPct,
    favoredName,
    modelSource,
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

  if (compact) {
    return (
      <div
        className="w-full select-none"
        role="region"
        aria-label={`Win probability: ${homeAbbr} ${homePct.toFixed(1)}%, ${awayAbbr} ${awayPct.toFixed(1)}%`}
      >
        <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0 ring-1 ring-white/20"
              style={{ backgroundColor: homeColor }}
            />
            <span className="text-white">{homeAbbr}</span>
            <span
              className="tabular-nums"
              style={{ color: isHomeFavored ? '#38bdf8' : '#94a3b8' }}
            >
              {homePct.toFixed(1)}%
            </span>
          </div>

          <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
            Win Prob
          </span>

          <div className="flex items-center gap-1.5">
            <span
              className="tabular-nums"
              style={{ color: isAwayFavored ? '#38bdf8' : '#94a3b8' }}
            >
              {awayPct.toFixed(1)}%
            </span>
            <span className="text-white">{awayAbbr}</span>
            <span
              className="h-2 w-2 rounded-full shrink-0 ring-1 ring-white/20"
              style={{ backgroundColor: awayColor }}
            />
          </div>
        </div>

        {/* Crisp dual-segment progress track */}
        <div className="relative h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden flex">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${homePct}%`, backgroundColor: homeColor }}
          />
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${awayPct}%`, backgroundColor: awayColor }}
          />
          {/* 50% baseline center tick */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/40 pointer-events-none" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-xl border border-white/[0.08] bg-[#090e18] p-3.5 select-none shadow-sm"
      role="region"
      aria-label={`Win probability: ${homeAbbr} ${homePct.toFixed(1)}%, ${awayAbbr} ${awayPct.toFixed(1)}% (${modelSource})`}
    >
      {/* High-Impact Broadcast Dual Header */}
      <div className="mb-2 flex items-center justify-between gap-1">
        {/* Home Team Probability Capsule */}
        <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all ${
          isHomeFavored
            ? 'bg-white/[0.06] border border-white/[0.12] shadow-sm'
            : 'bg-transparent'
        }`}>
          <div className="relative flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30 shrink-0 shadow-sm"
              style={{ backgroundColor: homeColor }}
            />
            {safeHomeComp.team?.logo && (
              <img
                src={safeHomeComp.team.logo}
                alt=""
                className="h-4 w-4 object-contain filter drop-shadow-sm shrink-0 hidden sm:inline"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <span className="font-extrabold text-xs text-white tracking-wide leading-tight">
              {homeAbbr}
            </span>
          </div>
          <span
            className="font-mono text-sm sm:text-base font-black tracking-tight tabular-nums ml-0.5"
            style={{ color: isHomeFavored ? '#38bdf8' : '#e2e8f0' }}
          >
            {homePct.toFixed(1)}%
          </span>
        </div>

        {/* Center Win Probability Pill */}
        <div className="flex flex-col items-center shrink-0 px-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Activity className="h-3 w-3 text-sky-400" />
            WIN PROB
          </span>
        </div>

        {/* Away Team Probability Capsule */}
        <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all ${
          isAwayFavored
            ? 'bg-white/[0.06] border border-white/[0.12] shadow-sm'
            : 'bg-transparent'
        }`}>
          <span
            className="font-mono text-sm sm:text-base font-black tracking-tight tabular-nums mr-0.5"
            style={{ color: isAwayFavored ? '#f43f5e' : '#e2e8f0' }}
          >
            {awayPct.toFixed(1)}%
          </span>
          <div className="relative flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-white tracking-wide leading-tight">
              {awayAbbr}
            </span>
            {safeAwayComp.team?.logo && (
              <img
                src={safeAwayComp.team.logo}
                alt=""
                className="h-4 w-4 object-contain filter drop-shadow-sm shrink-0 hidden sm:inline"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <span
              className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30 shrink-0 shadow-sm"
              style={{ backgroundColor: awayColor }}
            />
          </div>
        </div>
      </div>

      {/* Visual Dual-Colored Split Bar with High Contrast, Textural Hatching & WAI-ARIA Meter Semantics */}
      <div
        className="relative h-4 w-full overflow-hidden rounded-full bg-[#05080f] p-0.5 border border-white/[0.12] shadow-inner"
        role="meter"
        aria-valuenow={Math.round(homePct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Win probability meter: ${homeAbbr} vs ${awayAbbr}`}
        aria-valuetext={`${homeAbbr} ${homePct.toFixed(1)}%, ${awayAbbr} ${awayPct.toFixed(1)}%. ${isHomeFavored ? `${homeAbbr} favored` : isAwayFavored ? `${awayAbbr} favored` : 'Even matchup'}`}
      >
        <div className="flex h-full w-full rounded-full overflow-hidden">
          {/* Home Segment with Color-Blind Stipple Texture */}
          <div
            className="h-full transition-all duration-700 ease-out relative"
            style={{
              width: `${homePct}%`,
              background: `linear-gradient(90deg, ${homeColor}, ${homeColor}ee)`,
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

          {/* Away Segment with Color-Blind Diagonal Textural Hatch */}
          <div
            className="h-full transition-all duration-700 ease-out relative"
            style={{
              width: `${awayPct}%`,
              background: `linear-gradient(90deg, ${awayColor}ee, ${awayColor})`,
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

        {/* 25% Baseline Tick */}
        <div
          className="absolute top-0 bottom-0 left-[25%] w-[1px] bg-white/20 pointer-events-none"
          title="25%"
        />

        {/* 50% Center Baseline Tick & Marker */}
        <div
          className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/60 shadow-sm pointer-events-none"
          title="50% Even Baseline"
        />

        {/* 75% Baseline Tick */}
        <div
          className="absolute top-0 bottom-0 left-[75%] w-[1px] bg-white/20 pointer-events-none"
          title="75%"
        />

        {/* Dynamic Glowing Needlesplit at exact probability boundary */}
        <div
          className="absolute top-0 bottom-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-700 ease-out pointer-events-none"
          style={{ left: `${homePct}%` }}
        />
      </div>

      {/* Bar Scale Labels (25%, 50%, 75%) */}
      <div className="mt-1.5 flex items-center justify-between px-1 text-xs font-mono text-slate-400">
        <span>{homeAbbr} 100%</span>
        <span>25%</span>
        <span className="font-bold text-slate-200">50% EVEN</span>
        <span>75%</span>
        <span>{awayAbbr} 100%</span>
      </div>

      {/* Favored / Projected Insight Strip */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-300 border-t border-white/[0.06] pt-1.5">
        <div className="truncate min-w-0 mr-1.5 flex items-center gap-1">
          {isHomeFavored || isAwayFavored ? (
            <span className="flex items-center gap-1 truncate text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <strong className="text-white font-bold truncate">{favoredName}</strong>
              <span className="font-mono font-black text-emerald-400 shrink-0">+{spreadPct}%</span>
              <span className="text-slate-400 shrink-0">edge</span>
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Even matchup (50.0% / 50.0%)</span>
          )}
        </div>
        <span className="text-xs font-mono font-semibold text-slate-400 uppercase shrink-0 bg-white/[0.04] px-1.5 py-0.5 rounded-md border border-white/[0.06]">
          {modelSource}
        </span>
      </div>
    </div>
  )
})

