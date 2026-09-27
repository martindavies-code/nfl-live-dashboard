import React, { memo } from 'react'
import type { NFLCompetitor } from '../types/nfl'
import { safeParseInt, sanitizeHexColor } from '../utils/nflHelpers'

interface WinProbabilityBarProps {
  homeWinPercentage?: number | null
  awayWinPercentage?: number | null
  homeCompetitor: NFLCompetitor
  awayCompetitor: NFLCompetitor
  gameState?: 'pre' | 'in' | 'post'
}

export const WinProbabilityBar: React.FC<WinProbabilityBarProps> = memo(({
  homeWinPercentage,
  awayWinPercentage,
  homeCompetitor,
  awayCompetitor,
  gameState = 'in',
}) => {
  const homeColor = sanitizeHexColor(homeCompetitor?.team?.color, '#1e3a8a')
  const awayColor = sanitizeHexColor(awayCompetitor?.team?.color, '#b91c1c')

  const homeAbbr = homeCompetitor?.team?.abbreviation || 'HOME'
  const awayAbbr = awayCompetitor?.team?.abbreviation || 'AWAY'
  const homeName = homeCompetitor?.team?.displayName || homeAbbr
  const awayName = awayCompetitor?.team?.displayName || awayAbbr

  let homePct = 50
  let awayPct = 50

  if (gameState === 'post') {
    const homeScore = safeParseInt(homeCompetitor?.score, 0)
    const awayScore = safeParseInt(awayCompetitor?.score, 0)
    if (homeScore > awayScore) {
      homePct = 100
      awayPct = 0
    } else if (awayScore > homeScore) {
      homePct = 0
      awayPct = 100
    } else {
      homePct = 50
      awayPct = 50
    }
  } else if (typeof homeWinPercentage === 'number' && Number.isFinite(homeWinPercentage)) {
    // If it's a decimal (0.0 to 1.0), multiply by 100
    homePct = homeWinPercentage <= 1 ? homeWinPercentage * 100 : homeWinPercentage
    if (typeof awayWinPercentage === 'number' && Number.isFinite(awayWinPercentage)) {
      awayPct = awayWinPercentage <= 1 ? awayWinPercentage * 100 : awayWinPercentage
    } else {
      awayPct = 100 - homePct
    }
  } else if (gameState === 'in') {
    // Fallback live estimate from score differential
    const homeScore = safeParseInt(homeCompetitor?.score, 0)
    const awayScore = safeParseInt(awayCompetitor?.score, 0)
    const diff = homeScore - awayScore
    const estimate = 50 + Math.max(-42, Math.min(42, diff * 3.5))
    homePct = Number.isFinite(estimate) ? estimate : 50
    awayPct = 100 - homePct
  }

  // Ensure safe numbers
  if (!Number.isFinite(homePct) || !Number.isFinite(awayPct)) {
    homePct = 50
    awayPct = 50
  }

  // Clamping to visually sensible bounds — always ensure home + away = 100
  homePct = Math.max(2, Math.min(98, Math.round(homePct * 10) / 10))
  awayPct = Math.round((100 - homePct) * 10) / 10

  const isHomeFavored = homePct > awayPct
  const isAwayFavored = awayPct > homePct
  const spread = Math.abs(homePct - awayPct).toFixed(1)

  return (
    <div
      className="w-full rounded-xl border border-white/[0.08] bg-[#0c121e] p-3 select-none"
      role="region"
      aria-label={`Win probability: ${homeAbbr} ${homePct.toFixed(1)}%, ${awayAbbr} ${awayPct.toFixed(1)}%`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between text-xs">
        {/* Home Team Probability */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
            style={{ backgroundColor: homeColor }}
          />
          <span className="font-bold text-white tracking-wide">{homeAbbr}</span>
          <span className="font-mono text-sm font-extrabold text-white ml-0.5 tabular-nums">
            {homePct.toFixed(1)}%
          </span>
        </div>

        {/* Central Insight Header */}
        <div className="text-[11px] font-medium text-slate-400">
          {isHomeFavored ? (
            <span className="text-slate-300 font-semibold">
              <strong className="text-white">{homeName}</strong> favoured by {spread}%
            </span>
          ) : isAwayFavored ? (
            <span className="text-slate-300 font-semibold">
              <strong className="text-white">{awayName}</strong> favoured by {spread}%
            </span>
          ) : (
            <span className="text-slate-400">Even odds (50 / 50)</span>
          )}
        </div>

        {/* Away Team Probability */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-extrabold text-white mr-0.5 tabular-nums">
            {awayPct.toFixed(1)}%
          </span>
          <span className="font-bold text-white tracking-wide">{awayAbbr}</span>
          <span
            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
            style={{ backgroundColor: awayColor }}
          />
        </div>
      </div>

      {/* Visual Dual-Colored Split Bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#080d16] p-0.5 border border-white/[0.06]">
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
          className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/80 shadow"
          title="50% Even Baseline"
        />
      </div>
    </div>
  )
})
