import React, { memo } from 'react'
import type { NFLCompetitor, NFLSituation, NFLStatus, NFLOdds } from '../types/nfl'
import { sanitizeHexColor } from '../utils/nflHelpers'
import { calculateWinProbability } from '../utils/winProbability'

interface WinProbabilityBarProps {
  homeWinPercentage?: number | null
  awayWinPercentage?: number | null
  homeCompetitor: NFLCompetitor
  awayCompetitor: NFLCompetitor
  gameState?: 'pre' | 'in' | 'post'
  status?: NFLStatus
  situation?: NFLSituation | null
  odds?: NFLOdds[]
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
}) => {
  const homeColor = sanitizeHexColor(homeCompetitor?.team?.color, '#1e3a8a')
  const awayColor = sanitizeHexColor(awayCompetitor?.team?.color, '#b91c1c')

  const homeAbbr = homeCompetitor?.team?.abbreviation || 'HOME'
  const awayAbbr = awayCompetitor?.team?.abbreviation || 'AWAY'

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
    homeCompetitor,
    awayCompetitor,
    gameState,
    status,
    situation,
    odds,
  })

  return (
    <div
      className="w-full rounded-xl border border-white/[0.08] bg-[#0c121e] p-3 select-none"
      role="region"
      aria-label={`Win probability: ${homeAbbr} ${homePct.toFixed(1)}%, ${awayAbbr} ${awayPct.toFixed(1)}% (${modelSource})`}
    >
      {/* Probability Numbers Header */}
      <div className="mb-2 flex items-center justify-between text-xs">
        {/* Home Team Probability */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20 shrink-0"
            style={{ backgroundColor: homeColor }}
          />
          <span className="font-bold text-white tracking-wide">{homeAbbr}</span>
          <span className="font-mono text-sm font-extrabold text-white ml-0.5 tabular-nums">
            {homePct.toFixed(1)}%
          </span>
        </div>

        {/* Central Clean Label */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 px-2">
          Win Prob
        </span>

        {/* Away Team Probability */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-sm font-extrabold text-white mr-0.5 tabular-nums">
            {awayPct.toFixed(1)}%
          </span>
          <span className="font-bold text-white tracking-wide">{awayAbbr}</span>
          <span
            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20 shrink-0"
            style={{ backgroundColor: awayColor }}
          />
        </div>
      </div>

      {/* Visual Dual-Colored Split Bar */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#080d16] p-0.5 border border-white/[0.06]">
        <div className="flex h-full w-full rounded-full overflow-hidden">
          {/* Home Segment */}
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${homePct}%`,
              backgroundColor: homeColor,
            }}
          />
          {/* Away Segment */}
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${awayPct}%`,
              backgroundColor: awayColor,
            }}
          />
        </div>

        {/* 50% Center Tick */}
        <div
          className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/90 shadow-sm"
          title="50% Baseline"
        />
      </div>

      {/* Favored / Projected Insight — Dedicated line below the bar with full card width */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <div className="truncate min-w-0 mr-2">
          {isHomeFavored || isAwayFavored ? (
            <span>
              <strong className="text-white font-medium">{favoredName}</strong> favoured by{' '}
              <span className="font-mono font-bold text-emerald-400">+{spreadPct}%</span>
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Even matchup (50 / 50)</span>
          )}
        </div>
        <span className="text-[10px] font-mono font-medium text-slate-400 uppercase shrink-0">
          {modelSource}
        </span>
      </div>
    </div>
  )
})
