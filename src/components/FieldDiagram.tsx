import React, { useId, memo } from 'react'
import type { NFLSituation, NFLCompetitor, NFLStatus } from '../types/nfl'
import { sanitizeHexColor, getOffensiveDrive, isRedZoneSituation, isHalftimeSituation } from '../utils/nflHelpers'

interface FieldDiagramProps {
  situation?: NFLSituation | null
  competitors: NFLCompetitor[]
  gameState?: 'pre' | 'in' | 'post'
  gameStatusDetail?: string
  isHero?: boolean
  status?: NFLStatus
}

export const FieldDiagram: React.FC<FieldDiagramProps> = memo(({
  situation,
  competitors,
  gameState = 'in',
  gameStatusDetail = 'In Progress',
  isHero = false,
  status,
}) => {
  const uniqueId = useId().replace(/:/g, '')

  const homeComp = competitors.find((c) => c.homeAway === 'home')
  const awayComp = competitors.find((c) => c.homeAway === 'away')

  const homeColor = sanitizeHexColor(homeComp?.team?.color, '#1e3a8a')
  const awayColor = sanitizeHexColor(awayComp?.team?.color, '#b91c1c')
  const homeAbbr = homeComp?.team?.abbreviation || 'HOME'
  const awayAbbr = awayComp?.team?.abbreviation || 'AWAY'

  // Handling missing/null situation
  const hasSituation = Boolean(
    situation &&
    typeof situation.yardLine === 'number' &&
    Number.isFinite(situation.yardLine) &&
    situation.down !== undefined
  )

  const { offensiveTeam, direction } = getOffensiveDrive(situation, competitors)

  // Coordinate conversion:
  // ESPN API: 0 is Home Goal Line, 100 is Away Goal Line
  // In our SVG:
  // x = 0..100: Home Endzone (10 yards)
  // x = 100..1100: Playing field (100 yards, 10 units per yard)
  // x = 1100..1200: Away Endzone (10 yards)
  const yardLineRaw = hasSituation ? situation!.yardLine : 50
  const yardLineClamped = Math.max(0, Math.min(100, yardLineRaw))
  const scrimmageX = 100 + yardLineClamped * 10

  // First down calculations (Only valid if down > 0)
  const isRegularPlay = hasSituation && situation!.down > 0
  const distance = hasSituation && situation!.distance > 0 ? situation!.distance : 10

  let firstDownYardLine = yardLineClamped
  if (direction === 'right') {
    firstDownYardLine = Math.min(100, yardLineClamped + distance)
  } else {
    firstDownYardLine = Math.max(0, yardLineClamped - distance)
  }
  const firstDownX = 100 + firstDownYardLine * 10

  const isGoalToGo =
    isRegularPlay &&
    ((direction === 'right' && yardLineClamped + distance >= 100) ||
      (direction === 'left' && yardLineClamped - distance <= 0))

  const inRedZone = isRedZoneSituation(situation, status, competitors)
  const isHalftime = isHalftimeSituation(status, situation)

  // Direct label text
  const losLabel = situation?.possessionText || `${yardLineClamped} YD`
  const firstDownLabel = isGoalToGo ? 'GOAL LINE' : `${distance} YDS TO GAIN`

  const gainZoneLeft = Math.min(scrimmageX, firstDownX)
  const gainZoneWidth = Math.abs(firstDownX - scrimmageX)

  // SVG Unique Def IDs
  const turfGradId = `turf-grad-${uniqueId}`
  const turfPatternId = `turf-pat-${uniqueId}`

  const accessibilityDesc = hasSituation
    ? `Football field diagram: Ball at ${losLabel}, ${situation?.downDistanceText || 'Active play'}, ${offensiveTeam?.team?.abbreviation || 'Offense'} driving towards ${direction === 'right' ? awayAbbr : homeAbbr}.`
    : `Football field view: ${gameState === 'pre' ? 'Pregame' : gameState === 'post' ? 'Game Over' : 'Field preview'}`

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c121e] ${
        isHero ? 'shadow-lg ring-1 ring-white/[0.04]' : ''
      }`}
      role="img"
      aria-label={accessibilityDesc}
    >
      {/* Context Strip */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#080d16] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Field Position
          </span>
          {inRedZone && (
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
              RED ZONE
            </span>
          )}
          {isHalftime && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
              HALFTIME
            </span>
          )}
        </div>

        {isHalftime ? (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-amber-300 font-mono">AT HALFTIME</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">2nd Half Kickoff Upcoming</span>
          </div>
        ) : hasSituation ? (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-amber-300 font-mono">
              {situation?.downDistanceText || `${situation?.shortDownDistanceText || 'Current Drive'}`}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              <strong className="text-white">{offensiveTeam?.team?.abbreviation}</strong> Driving{' '}
              <span className="text-amber-400 font-mono">{direction === 'right' ? '➔' : '⬅'}</span>
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">
            {gameState === 'pre' ? 'Pregame' : gameState === 'post' ? 'Final' : gameStatusDetail}
          </span>
        )}
      </div>

      {/* SVG American Football Pitch */}
      <div className="relative w-full aspect-[1200/340]">
        <svg
          viewBox="0 0 1200 340"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={turfGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#153621" />
              <stop offset="50%" stopColor="#194228" />
              <stop offset="100%" stopColor="#122f1d" />
            </linearGradient>

            <pattern id={turfPatternId} width="100" height="340" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="50" height="340" fill="rgba(255,255,255,0.02)" />
              <rect x="50" y="0" width="50" height="340" fill="rgba(0,0,0,0.04)" />
            </pattern>
          </defs>

          {/* Turf Background */}
          <rect x="0" y="0" width="1200" height="340" fill={`url(#${turfGradId})`} />
          <rect x="100" y="0" width="1000" height="340" fill={`url(#${turfPatternId})`} />

          {/* HOME ENDZONE (Left, 0-100) */}
          <g>
            <rect x="0" y="0" width="100" height="340" fill={homeColor} fillOpacity="0.85" />
            <path
              d="M0,0 L100,100 M0,85 L100,185 M0,170 L100,270 M0,255 L100,340"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="2.5"
            />
            <text
              x="50"
              y="170"
              fill="#ffffff"
              fontSize="22"
              fontWeight="700"
              fontFamily="var(--font-display)"
              textAnchor="middle"
              dominantBaseline="middle"
              transform="rotate(-90 50 170)"
              letterSpacing="2"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
            >
              {homeAbbr}
            </text>
          </g>

          {/* AWAY ENDZONE (Right, 1100-1200) */}
          <g>
            <rect x="1100" y="0" width="100" height="340" fill={awayColor} fillOpacity="0.85" />
            <path
              d="M1100,0 L1200,100 M1100,85 L1200,185 M1100,170 L1200,270 M1100,255 L1200,340"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="2.5"
            />
            <text
              x="1150"
              y="170"
              fill="#ffffff"
              fontSize="22"
              fontWeight="700"
              fontFamily="var(--font-display)"
              textAnchor="middle"
              dominantBaseline="middle"
              transform="rotate(90 1150 170)"
              letterSpacing="2"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
            >
              {awayAbbr}
            </text>
          </g>

          {/* Boundary Chalk Lines */}
          <line x1="0" y1="2" x2="1200" y2="2" stroke="rgba(255,255,255,0.8)" strokeWidth="3" />
          <line x1="0" y1="338" x2="1200" y2="338" stroke="rgba(255,255,255,0.8)" strokeWidth="3" />
          <line x1="100" y1="0" x2="100" y2="340" stroke="#ffffff" strokeWidth="4" />
          <line x1="1100" y1="0" x2="1100" y2="340" stroke="#ffffff" strokeWidth="4" />

          {/* 10-Yard Markings & Direct Numbers */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yardVal) => {
            const x = 100 + yardVal * 10
            const displayNum = yardVal <= 50 ? yardVal : 100 - yardVal
            const showArrow = yardVal !== 50
            const arrowDir = yardVal < 50 ? '◀' : '▶'

            return (
              <g key={`yd-${yardVal}`}>
                <line
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="340"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y="46"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="18"
                  fontWeight="700"
                  fontFamily="var(--font-display)"
                  textAnchor="middle"
                >
                  {showArrow && yardVal > 50 && <tspan fontSize="12">{arrowDir} </tspan>}
                  {displayNum}
                  {showArrow && yardVal < 50 && <tspan fontSize="12"> {arrowDir}</tspan>}
                </text>
                <text
                  x={x}
                  y="304"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="18"
                  fontWeight="700"
                  fontFamily="var(--font-display)"
                  textAnchor="middle"
                >
                  {showArrow && yardVal > 50 && <tspan fontSize="12">{arrowDir} </tspan>}
                  {displayNum}
                  {showArrow && yardVal < 50 && <tspan fontSize="12"> {arrowDir}</tspan>}
                </text>
              </g>
            )
          })}

          {/* 5-yard dashed lines */}
          {[5, 15, 25, 35, 45, 55, 65, 75, 85, 95].map((y5) => (
            <line
              key={`5y-${y5}`}
              x1={100 + y5 * 10}
              y1="0"
              x2={100 + y5 * 10}
              y2="340"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              strokeDasharray="5,4"
            />
          ))}

          {/* Hash Marks */}
          {Array.from({ length: 99 }, (_, i) => i + 1)
            .filter((y) => y % 5 !== 0)
            .map((yard) => {
              const x = 100 + yard * 10
              return (
                <g key={`h-${yard}`} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                  <line x1={x} y1="4" x2={x} y2="14" />
                  <line x1={x} y1="120" x2={x} y2="130" />
                  <line x1={x} y1="210" x2={x} y2="220" />
                  <line x1={x} y1="326" x2={x} y2="336" />
                </g>
              )
            })}

          {/* Red Zone Tint (Opponent's 20-yard line to goal) */}
          {inRedZone && (
            <rect
              x={direction === 'right' ? 900 : 100}
              y="0"
              width="200"
              height="340"
              fill="rgba(225, 29, 72, 0.14)"
            />
          )}

          {/* SITUATION OVERLAYS */}
          {hasSituation && (
            <>
              {/* Yards to Gain Corridor (Only on scrimmage downs) */}
              {isRegularPlay && gainZoneWidth > 0 && (
                <rect
                  x={gainZoneLeft}
                  y="0"
                  width={gainZoneWidth}
                  height="340"
                  fill="rgba(234, 179, 8, 0.15)"
                />
              )}

              {/* 1st Down Marker (Yellow Broadcast Line - Only when down > 0) */}
              {isRegularPlay && (
                <>
                  <line
                    x1={firstDownX}
                    y1="0"
                    x2={firstDownX}
                    y2="340"
                    stroke="#eab308"
                    strokeWidth="3.5"
                    strokeDasharray={isGoalToGo ? '6,3' : undefined}
                  />

                  {/* Direct 1st Down Label Tag (offset to bottom on short-yardage plays to eliminate collision with LOS badge) */}
                  <g transform={`translate(${firstDownX}, ${Math.abs(firstDownX - scrimmageX) < 55 ? 322 : 18})`}>
                    <rect x="-24" y="-12" width="48" height="20" rx="4" fill="#eab308" />
                    <text
                      x="0"
                      y="2"
                      fill="#0f172a"
                      fontSize="10"
                      fontWeight="800"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {isGoalToGo ? 'GOAL' : '1ST DOWN'}
                    </text>
                  </g>
                </>
              )}

              {/* Line of Scrimmage (Cyan Broadcast Line) */}
              <line
                x1={scrimmageX}
                y1="0"
                x2={scrimmageX}
                y2="340"
                stroke="#38bdf8"
                strokeWidth="3.5"
              />

              {/* Direct Line of Scrimmage Label */}
              <g transform={`translate(${scrimmageX}, 18)`}>
                <rect x="-22" y="-12" width="44" height="20" rx="4" fill="#0284c7" />
                <text
                  x="0"
                  y="2"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  LOS
                </text>
              </g>

              {/* Play Direction Arrow */}
              <g transform={`translate(${scrimmageX}, 170)`}>
                <path
                  d={
                    direction === 'right'
                      ? 'M 20,-14 L 38,0 L 20,14'
                      : 'M -20,-14 L -38,0 L -20,14'
                  }
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              {/* Football positioned at exact yard line */}
              <g
                transform={`translate(${scrimmageX}, 170) ${
                  direction === 'left' ? 'rotate(-20)' : 'rotate(20)'
                }`}
              >
                <path
                  d="M -22,0 C -22,-14 22,-14 22,0 C 22,14 -22,14 -22,0 Z"
                  fill="#854d0e"
                  stroke="#451a03"
                  strokeWidth="1.5"
                />
                <path d="M -15,-8 C -14,-8 -14,8 -15,8" stroke="#ffffff" strokeWidth="2" fill="none" />
                <path d="M 15,-8 C 14,-8 14,8 15,8" stroke="#ffffff" strokeWidth="2" fill="none" />
                <line x1="-7" y1="0" x2="7" y2="0" stroke="#ffffff" strokeWidth="2" />
                <line x1="-5" y1="-2.5" x2="-5" y2="2.5" stroke="#ffffff" strokeWidth="1.2" />
                <line x1="-1" y1="-3" x2="-1" y2="3" stroke="#ffffff" strokeWidth="1.2" />
                <line x1="3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.2" />
              </g>

              {/* Direct Yard Line Callout under Ball */}
              <g transform={`translate(${scrimmageX}, 215)`}>
                <rect
                  x="-38"
                  y="-10"
                  width="76"
                  height="20"
                  rx="4"
                  fill="#090d16"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="2"
                  fill="#f1f5f9"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {losLabel}
                </text>
              </g>
            </>
          )}

          {/* Clear Inactive/Scheduled state */}
          {!hasSituation && (
            <g transform="translate(600, 170)">
              <rect
                x="-160"
                y="-26"
                width="320"
                height="52"
                rx="8"
                fill="#090d16"
                fillOpacity="0.9"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
              <text
                x="0"
                y="-4"
                fill="#ffffff"
                fontSize="13"
                fontWeight="700"
                fontFamily="var(--font-sans)"
                textAnchor="middle"
              >
                {gameState === 'pre'
                  ? 'Pregame Tactical View'
                  : gameState === 'post'
                  ? 'Game Concluded'
                  : 'Play Paused'}
              </text>
              <text
                x="0"
                y="14"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                {gameStatusDetail || 'Awaiting Next Drive'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Direct In-place Context Strip */}
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#080d16] px-3.5 py-1.5 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-sky-400" />
            <strong className="text-slate-300">Scrimmage:</strong> {hasSituation ? losLabel : '50 YD'}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-yellow-400" />
            <strong className="text-slate-300">Target:</strong>{' '}
            {isRegularPlay ? firstDownLabel : hasSituation ? 'Kickoff / PAT' : '10 Yds'}
          </span>
        </div>

        <span className="font-mono text-[10px] text-slate-400">
          100-Yard Field • Endzones 10 Yds
        </span>
      </div>
    </div>
  )
})

