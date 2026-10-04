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
  compact?: boolean
}

export const FieldDiagram: React.FC<FieldDiagramProps> = memo(({
  situation,
  competitors,
  gameState = 'in',
  gameStatusDetail = 'In Progress',
  isHero = false,
  status,
  compact = false,
}) => {
  const isCompact = compact || !isHero
  const uniqueId = useId().replace(/:/g, '')

  const homeComp = competitors.find((c) => c.homeAway === 'home')
  const awayComp = competitors.find((c) => c.homeAway === 'away')

  const homeColor = sanitizeHexColor(homeComp?.team?.color, '#1e3a8a')
  const awayColor = sanitizeHexColor(awayComp?.team?.color, '#b91c1c')
  const rawHomeAbbr = homeComp?.team?.abbreviation || 'HOME'
  const rawAwayAbbr = awayComp?.team?.abbreviation || 'AWAY'
  const homeAbbr = rawHomeAbbr === 'NE' ? 'FNE' : rawHomeAbbr
  const awayAbbr = rawAwayAbbr === 'NE' ? 'FNE' : rawAwayAbbr

  // Handling missing/null situation
  const hasSituation = Boolean(
    situation &&
    typeof situation.yardLine === 'number' &&
    Number.isFinite(situation.yardLine) &&
    typeof situation.down === 'number' &&
    Number.isFinite(situation.down)
  )

  const { offensiveTeam, direction } = getOffensiveDrive(situation, competitors)

  // Coordinate conversion:
  // ESPN API: 0 is Home Goal Line, 100 is Away Goal Line
  // In our SVG:
  // x = 0..100: Home Endzone (10 yards)
  // x = 100..1100: Playing field (100 yards, 10 units per yard)
  // x = 1100..1200: Away Endzone (10 yards)
  const yardLineRaw = hasSituation ? situation!.yardLine : 50
  const yardLineClamped = Math.max(0, Math.min(100, Number.isFinite(yardLineRaw) ? yardLineRaw : 50))
  const scrimmageX = 100 + yardLineClamped * 10

  const isHalftime = isHalftimeSituation(status, situation)
  const inRedZone = isRedZoneSituation(situation, status, competitors)

  // First down calculations (Only valid on active scrimmage downs during live play)
  const isRegularPlay = hasSituation && situation!.down > 0 && !isHalftime && gameState === 'in'
  const rawDistance = hasSituation && typeof situation!.distance === 'number' && Number.isFinite(situation!.distance) ? situation!.distance : 10
  const distance = Math.max(0, rawDistance)

  let firstDownYardLine = yardLineClamped
  if (direction === 'right') {
    firstDownYardLine = Math.min(100, yardLineClamped + (distance === 0 ? 0.5 : distance))
  } else {
    firstDownYardLine = Math.max(0, yardLineClamped - (distance === 0 ? 0.5 : distance))
  }
  const firstDownX = 100 + (Number.isFinite(firstDownYardLine) ? firstDownYardLine : 50) * 10

  const isGoalToGo =
    isRegularPlay &&
    ((direction === 'right' && yardLineClamped + distance >= 100) ||
      (direction === 'left' && yardLineClamped - distance <= 0))

  // Direct label text
  const losLabel = situation?.possessionText || `${yardLineClamped} YD`
  const firstDownLabel = isGoalToGo
    ? 'GOAL LINE'
    : distance === 0
    ? 'INCHES TO GAIN'
    : `${distance} YDS TO GAIN`

  const gainZoneLeft = Math.min(scrimmageX, firstDownX)
  const gainZoneWidth = Math.abs(firstDownX - scrimmageX)

  // Boundary-clamped Badge coordinates to avoid clipping into endzones (0..100 and 1100..1200)
  const losBadgeX = Math.max(124, Math.min(1076, scrimmageX))
  const firstDownBadgeX = Math.max(126, Math.min(1074, firstDownX))
  const pillX = Math.max(180, Math.min(1020, scrimmageX))

  // Mathematically invariant Big Play Direction Arrow coordinates (never collapses, perfectly centered text)
  const arrowLength = 110
  let arrowStartX: number
  let arrowTipX: number
  let arrowHeadBaseX: number
  let arrowTextX: number
  let arrowPathD: string

  if (direction === 'right') {
    const rawTipX = scrimmageX + 28 + arrowLength
    arrowTipX = Math.min(1185, rawTipX)
    arrowStartX = arrowTipX - arrowLength
    arrowHeadBaseX = arrowTipX - 32
    arrowTextX = (arrowStartX + arrowHeadBaseX) / 2
    arrowPathD = `M ${arrowStartX},157 L ${arrowHeadBaseX},157 L ${arrowHeadBaseX},142 L ${arrowTipX},170 L ${arrowHeadBaseX},198 L ${arrowHeadBaseX},183 L ${arrowStartX},183 Z`
  } else {
    const rawTipX = scrimmageX - 28 - arrowLength
    arrowTipX = Math.max(15, rawTipX)
    arrowStartX = arrowTipX + arrowLength
    arrowHeadBaseX = arrowTipX + 32
    arrowTextX = (arrowStartX + arrowHeadBaseX) / 2
    arrowPathD = `M ${arrowStartX},157 L ${arrowHeadBaseX},157 L ${arrowHeadBaseX},142 L ${arrowTipX},170 L ${arrowHeadBaseX},198 L ${arrowHeadBaseX},183 L ${arrowStartX},183 Z`
  }

  // SVG Unique Def IDs
  const turfGradId = `turf-grad-${uniqueId}`
  const turfPatternId = `turf-pat-${uniqueId}`
  const ballGradId = `ball-grad-${uniqueId}`
  const arrowGradId = `arrow-grad-${uniqueId}`
  const titleId = `field-title-${uniqueId}`
  const descId = `field-desc-${uniqueId}`
  const homePatternId = `hatch-home-${uniqueId}`
  const awayPatternId = `hatch-away-${uniqueId}`
  const redZonePatternId = `hatch-redzone-${uniqueId}`

  const rawOffensiveAbbr = offensiveTeam?.team?.abbreviation || 'Offense'
  const offensiveAbbr = rawOffensiveAbbr === 'NE' ? 'FNE' : rawOffensiveAbbr
  const accessibilityDesc = hasSituation
    ? `Football field diagram: Ball at ${losLabel}, ${situation?.downDistanceText || 'Active play'}, ${offensiveAbbr} driving towards ${direction === 'right' ? awayAbbr : homeAbbr}.`
    : `Football field view: ${gameState === 'pre' ? 'Pregame' : gameState === 'post' ? 'Game Over' : 'Field preview'}`

  return (
    <div
      className={`w-full overflow-hidden ${
        isCompact
          ? 'rounded-lg border border-white/[0.08] bg-[#070b14]'
          : 'rounded-xl border border-white/[0.08] bg-[#0c121e]'
      } ${
        isHero ? 'shadow-lg ring-1 ring-white/[0.04]' : 'shadow-inner'
      }`}
      role="region"
      aria-label={accessibilityDesc}
    >
      {/* Screen Reader Detailed Tactical Breakdown */}
      <div className="sr-only">
        <h4>Tactical Drive Breakdown</h4>
        <dl>
          <dt>Offense</dt>
          <dd>{offensiveAbbr} (attacking {direction === 'right' ? awayAbbr : homeAbbr} end zone)</dd>
          <dt>Line of Scrimmage</dt>
          <dd>{losLabel}</dd>
          <dt>Down and Distance</dt>
          <dd>{situation?.downDistanceText || 'Between plays'}</dd>
          <dt>Target Line</dt>
          <dd>{firstDownLabel}</dd>
          <dt>Red Zone Status</dt>
          <dd>{inRedZone ? 'Active Red Zone Threat' : 'Regular Field Position'}</dd>
        </dl>
      </div>

      {/* Context Strip */}
      {isCompact ? (
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#060a12] px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            {isHalftime ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                HALFTIME
              </span>
            ) : hasSituation ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-200 truncate">
                <span className="text-white font-extrabold">{offensiveAbbr}</span>
                <span>DRIVING</span>
                <span className="text-amber-400 font-black">{direction === 'right' ? '➔' : '◀'}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                {gameState === 'pre' ? 'Pregame' : gameState === 'post' ? 'Final' : gameStatusDetail}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
            {isHalftime ? (
              <span className="text-amber-300 font-semibold">2nd Half Kickoff Upcoming</span>
            ) : hasSituation ? (
              <span className="text-slate-400">
                Ball on <strong className="text-white font-bold">{losLabel}</strong>
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#080d16] px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Field Position Radar
            </span>
            {inRedZone && (
              <span className="rounded bg-rose-500/25 px-2 py-0.5 text-[10px] font-black text-rose-300 border border-rose-500/40 animate-pulse whitespace-nowrap">
                🔥 RED ZONE
              </span>
            )}
            {isHalftime && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 whitespace-nowrap">
                HALFTIME
              </span>
            )}
          </div>

          {isHalftime ? (
            <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <span className="text-amber-300 font-mono whitespace-nowrap">AT HALFTIME</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 whitespace-nowrap">2nd Half Kickoff Upcoming</span>
            </div>
          ) : hasSituation ? (
            <div className="flex items-center gap-2 text-xs font-semibold min-w-0">
              <span className="text-amber-300 font-mono font-bold bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                {situation?.downDistanceText || `${situation?.shortDownDistanceText || 'Current Drive'}`}
              </span>
              <span className="text-slate-500 shrink-0">•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-200 border border-amber-500/40 shadow-sm shrink-0 whitespace-nowrap">
                <strong className="text-white">{offensiveAbbr}</strong>
                <span>DRIVING</span>
                <span className="text-base font-extrabold text-amber-400">{direction === 'right' ? '➔' : '◀'}</span>
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic shrink-0">
              {gameState === 'pre' ? 'Pregame' : gameState === 'post' ? 'Final' : gameStatusDetail}
            </span>
          )}
        </div>
      )}

      {/* SVG American Football Pitch with Full WCAG 2.2 AAA Semantic Tree */}
      <div className="relative w-full aspect-[1200/340]">
        <svg
          viewBox="0 0 1200 340"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>
            {hasSituation
              ? `Football field: ${offensiveAbbr} at ${losLabel}, ${situation?.downDistanceText || 'Active play'}`
              : `Football field: ${gameState === 'pre' ? 'Pregame' : gameState === 'post' ? 'Game Final' : 'Tactical overview'}`}
          </title>
          <desc id={descId}>
            {hasSituation
              ? `${offensiveAbbr} is driving towards ${direction === 'right' ? awayAbbr : homeAbbr} end zone. Ball on ${losLabel}. Target line: ${firstDownLabel}.${inRedZone ? ' Currently in the Red Zone.' : ''}`
              : `Tactical 100-yard field showing ${homeAbbr} defending left endzone and ${awayAbbr} defending right endzone.`}
          </desc>

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

            {/* Color-Blind Safe Texture Patterns (WCAG 1.4.1 Invariance) */}
            <pattern id={homePatternId} width="14" height="14" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
            </pattern>

            <pattern id={awayPatternId} width="14" height="14" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
            </pattern>

            <pattern id={redZonePatternId} width="14" height="14" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(244,63,94,0.45)" strokeWidth="2.5" />
              <line x1="0" y1="0" x2="14" y2="0" stroke="rgba(244,63,94,0.45)" strokeWidth="2.5" />
            </pattern>

            {/* Pro Football Saddle Leather Gradient */}
            <linearGradient id={ballGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="35%" stopColor="#92400e" />
              <stop offset="70%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* Tactical Drive Arrow Broadcast Gradient */}
            <linearGradient id={arrowGradId} x1={direction === 'right' ? "0%" : "100%"} y1="0%" x2={direction === 'right' ? "100%" : "0%"} y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Turf Background */}
          <rect x="0" y="0" width="1200" height="340" fill={`url(#${turfGradId})`} />
          <rect x="100" y="0" width="1000" height="340" fill={`url(#${turfPatternId})`} />

          {/* HOME ENDZONE (Left, 0-100) with Color-Blind Diagonal Stripes */}
          <g>
            <rect x="0" y="0" width="100" height="340" fill={homeColor} fillOpacity="0.85" />
            <rect x="0" y="0" width="100" height="340" fill={`url(#${homePatternId})`} />
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

          {/* AWAY ENDZONE (Right, 1100-1200) with Color-Blind Reverse Stripes */}
          <g>
            <rect x="1100" y="0" width="100" height="340" fill={awayColor} fillOpacity="0.85" />
            <rect x="1100" y="0" width="100" height="340" fill={`url(#${awayPatternId})`} />
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

          {/* Red Zone Tint (Opponent's 20-yard line to goal) with Color-Blind Cross-Hatch */}
          {inRedZone && (
            <g>
              <rect
                x={direction === 'right' ? 900 : 100}
                y="0"
                width="200"
                height="340"
                fill="rgba(225, 29, 72, 0.16)"
              />
              <rect
                x={direction === 'right' ? 900 : 100}
                y="0"
                width="200"
                height="340"
                fill={`url(#${redZonePatternId})`}
              />
            </g>
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
                  <g transform={`translate(${firstDownBadgeX}, ${Math.abs(firstDownX - scrimmageX) < (isCompact ? 45 : 55) ? 322 : 18})`}>
                    <rect
                      x={isCompact ? -18 : -24}
                      y={isCompact ? -10 : -12}
                      width={isCompact ? 36 : 48}
                      height={isCompact ? 16 : 20}
                      rx={isCompact ? 3 : 4}
                      fill="#eab308"
                    />
                    <text
                      x="0"
                      y={isCompact ? 1 : 2}
                      fill="#0f172a"
                      fontSize={isCompact ? "9" : "10"}
                      fontWeight="800"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {isGoalToGo ? 'GOAL' : isCompact ? '1ST' : '1ST DOWN'}
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

              {/* Direct Line of Scrimmage Label (Spelled out in hero, sleek compact tag in cards) */}
              <g transform={`translate(${losBadgeX}, 18)`}>
                <rect
                  x={isCompact ? -18 : -38}
                  y={isCompact ? -10 : -12}
                  width={isCompact ? 36 : 76}
                  height={isCompact ? 16 : 20}
                  rx={isCompact ? 3 : 4}
                  fill="#0284c7"
                />
                <text
                  x="0"
                  y={isCompact ? 1 : 2}
                  fill="#ffffff"
                  fontSize={isCompact ? "9" : "9.5"}
                  fontWeight="800"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  letterSpacing={isCompact ? "0" : "0.5"}
                >
                  {isCompact ? 'LOS' : 'SCRIMMAGE'}
                </text>
              </g>

              {/* BIG PLAY DIRECTION ARROW & BROADCAST DRIVING PILL (Only on active scrimmage plays) */}
              {isRegularPlay && (
                <g>
                  {/* High-Impact Tactical Ground Arrow pointing toward opponent's endzone (never collapses or clips) */}
                  <g>
                    <path
                      d={arrowPathD}
                      fill={`url(#${arrowGradId})`}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      filter="drop-shadow(0 4px 10px rgba(0,0,0,0.85))"
                    />
                    {/* High-Contrast Directional Drive Text precisely centered inside arrow shaft */}
                    <text
                      x={arrowTextX}
                      y="171"
                      fill="#0f172a"
                      fontSize="12"
                      fontWeight="900"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      letterSpacing="1.5"
                    >
                      {direction === 'right' ? 'DRIVE ➔' : '◀ DRIVE'}
                    </text>
                  </g>

                  {/* Prominent Drive Direction Pill Tag above Line of Scrimmage (rendered in hero mode for full-screen impact) */}
                  {!isCompact && (
                    <g transform={`translate(${pillX}, 82)`}>
                      <rect
                        x="-75"
                        y="-15"
                        width="150"
                        height="30"
                        rx="7"
                        fill="#080e18"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        filter="drop-shadow(0 4px 10px rgba(0,0,0,0.8))"
                      />
                      <text
                        x="0"
                        y="2"
                        fill="#fbbf24"
                        fontSize="12"
                        fontWeight="900"
                        fontFamily="var(--font-mono)"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        letterSpacing="1"
                      >
                        {direction === 'right' ? `${offensiveAbbr} DRIVING ➔` : `◀ DRIVING ${offensiveAbbr}`}
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* Halftime Intermission Banner on Field */}
              {isHalftime && (
                <g transform="translate(600, 170)">
                  <rect
                    x="-140"
                    y="-24"
                    width="280"
                    height="48"
                    rx="8"
                    fill="#090d16"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="-4"
                    fill="#fbbf24"
                    fontSize="13"
                    fontWeight="800"
                    fontFamily="var(--font-display)"
                    letterSpacing="1"
                    textAnchor="middle"
                  >
                    ⏸️ AT HALFTIME
                  </text>
                  <text
                    x="0"
                    y="14"
                    fill="#cbd5e1"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    2nd Half Kickoff Upcoming
                  </text>
                </g>
              )}

              {/* Authentic Wilson-Style NFL Pro Football */}
              <g transform={`translate(${scrimmageX}, 170)`}>
                {/* Turf Ground Shadow */}
                <ellipse cx="0" cy="16" rx="22" ry="5" fill="rgba(0,0,0,0.6)" filter="blur(1px)" />

                {/* Tactical Radar Pulse Ring */}
                <circle cx="0" cy="0" r="26" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />

                {/* Pro Leather Football Body */}
                <path
                  d="M -22,0 C -19,-13 -7,-13 0,-13 C 7,-13 19,-13 22,0 C 19,13 7,13 0,13 C -7,13 -19,13 -22,0 Z"
                  fill={`url(#${ballGradId})`}
                  stroke="#270e02"
                  strokeWidth="1.4"
                  filter="drop-shadow(0 3px 6px rgba(0,0,0,0.7))"
                />

                {/* White Pro Tip Stripes */}
                <path d="M -15,-9.5 C -13,-4 -13,4 -15,9.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.95" />
                <path d="M 15,-9.5 C 13,-4 13,4 15,9.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.95" />

                {/* White NFL Seam & Laces */}
                <line x1="-9" y1="0" x2="9" y2="0" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                <line x1="-6" y1="-3" x2="-6" y2="3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="-3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="6" y1="-3" x2="6" y2="3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
              </g>

              {/* Direct Yard Line Callout under Ball (rendered in hero mode for extra callout) */}
              {!isCompact && (
                <g transform={`translate(${scrimmageX}, 216)`}>
                  <rect
                    x="-44"
                    y="-11"
                    width="88"
                    height="22"
                    rx="5"
                    fill="#090d16"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                  />
                  <text
                    x="0"
                    y="2"
                    fill="#f1f5f9"
                    fontSize="10"
                    fontWeight="800"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    BALL AT {losLabel}
                  </text>
                </g>
              )}
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
      {isCompact ? (
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#060a12] px-3 py-1.5 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
              <span className="text-slate-400">LOS:</span>
              <strong className="text-slate-200">{isHalftime ? 'Halftime' : hasSituation ? losLabel : '50 YD'}</strong>
            </span>
            {isRegularPlay && (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
                <span className="text-slate-400">To Gain:</span>
                <strong className="text-amber-300">{isGoalToGo ? 'Goal Line' : `${distance} Yds`}</strong>
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
            {direction === 'right' ? `➔ ${awayAbbr}` : `◀ ${homeAbbr}`}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#080d16] px-3 py-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-sky-400" />
              <strong className="text-slate-300">Scrimmage:</strong> {isHalftime ? 'At Halftime' : hasSituation ? losLabel : '50 YD'}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-yellow-400" />
              <strong className="text-slate-300">Target:</strong>{' '}
              {isHalftime ? '2nd Half Kickoff' : isRegularPlay ? firstDownLabel : hasSituation ? 'Kickoff / PAT' : '10 Yds'}
            </span>
          </div>

          <span className="font-mono text-xs text-slate-500 hidden xl:inline">
            100-Yd Field
          </span>
        </div>
      )}
    </div>
  )
})

