import React, { useId, memo } from 'react'
import type { NFLSituation, NFLCompetitor, NFLStatus } from '../types/nfl'
import { sanitizeHexColor, getOffensiveDrive, isRedZoneSituation, isHalftimeSituation, formatDownAndDistance } from '../utils/nflHelpers'

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
  // y = 0..400: Field width (center y = 200)
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

  // Intelligent non-colliding vertical positioning for badges
  const isBadgeClose = Math.abs(firstDownX - scrimmageX) < 65
  const firstDownBadgeY = isBadgeClose ? 380 : 20

  // Sleek, compact broadcast directional arrow (60px long, no redundant text inside)
  const arrowLength = 60
  let arrowStartX: number
  let arrowTipX: number
  let arrowHeadBaseX: number
  let arrowPathD: string

  if (direction === 'right') {
    const rawTipX = scrimmageX + 26 + arrowLength
    arrowTipX = Math.min(1185, rawTipX)
    arrowStartX = arrowTipX - arrowLength
    arrowHeadBaseX = arrowTipX - 22
    arrowPathD = `M ${arrowStartX},188 L ${arrowHeadBaseX},188 L ${arrowHeadBaseX},176 L ${arrowTipX},200 L ${arrowHeadBaseX},224 L ${arrowHeadBaseX},212 L ${arrowStartX},212 Z`
  } else {
    const rawTipX = scrimmageX - 26 - arrowLength
    arrowTipX = Math.max(15, rawTipX)
    arrowStartX = arrowTipX + arrowLength
    arrowHeadBaseX = arrowTipX + 22
    arrowPathD = `M ${arrowStartX},188 L ${arrowHeadBaseX},188 L ${arrowHeadBaseX},176 L ${arrowTipX},200 L ${arrowHeadBaseX},224 L ${arrowHeadBaseX},212 L ${arrowStartX},212 Z`
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

      {/* Context Strip (Hero Mode Only) */}
      {!isCompact && (
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

      {/* SVG American Football Pitch: Scaled to 1200x400 for High-Impact Visibility on Big Displays */}
      <div className={
        isCompact
          ? "relative w-full aspect-[1200/400] min-h-[140px]"
          : "relative w-full aspect-[1200/400] min-h-[220px] sm:min-h-[270px] lg:min-h-[320px]"
      }>
        <svg
          viewBox="0 0 1200 400"
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

            <pattern id={turfPatternId} width="100" height="400" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="50" height="400" fill="rgba(255,255,255,0.02)" />
              <rect x="50" y="0" width="50" height="400" fill="rgba(0,0,0,0.04)" />
            </pattern>

            {/* Color-Blind Safe Texture Patterns (WCAG 1.4.1 Invariance) */}
            <pattern id={homePatternId} width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
            </pattern>

            <pattern id={awayPatternId} width="16" height="16" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
            </pattern>

            <pattern id={redZonePatternId} width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(244,63,94,0.45)" strokeWidth="2.5" />
              <line x1="0" y1="0" x2="16" y2="0" stroke="rgba(244,63,94,0.45)" strokeWidth="2.5" />
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
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Turf Background */}
          <rect x="0" y="0" width="1200" height="400" fill={`url(#${turfGradId})`} />
          <rect x="100" y="0" width="1000" height="400" fill={`url(#${turfPatternId})`} />

          {/* HOME ENDZONE (Left, 0-100) with Bold Team Abbreviation */}
          <g>
            <rect x="0" y="0" width="100" height="400" fill={homeColor} fillOpacity="0.85" />
            <rect x="0" y="0" width="100" height="400" fill={`url(#${homePatternId})`} />
            <text
              x="50"
              y="200"
              fill="#ffffff"
              fontSize="38"
              fontWeight="900"
              fontFamily="var(--font-display)"
              textAnchor="middle"
              dominantBaseline="middle"
              transform="rotate(-90 50 200)"
              letterSpacing="4"
              style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9))' }}
            >
              {homeAbbr}
            </text>
          </g>

          {/* AWAY ENDZONE (Right, 1100-1200) with Bold Team Abbreviation */}
          <g>
            <rect x="1100" y="0" width="100" height="400" fill={awayColor} fillOpacity="0.85" />
            <rect x="1100" y="0" width="100" height="400" fill={`url(#${awayPatternId})`} />
            <path
              d="M1100,0 L1200,100 M1100,100 L1200,200 M1100,200 L1200,300 M1100,300 L1200,400"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="2.5"
            />
            <text
              x="1150"
              y="200"
              fill="#ffffff"
              fontSize="38"
              fontWeight="900"
              fontFamily="var(--font-display)"
              textAnchor="middle"
              dominantBaseline="middle"
              transform="rotate(90 1150 200)"
              letterSpacing="4"
              style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9))' }}
            >
              {awayAbbr}
            </text>
          </g>

          {/* Boundary Chalk Lines */}
          <line x1="0" y1="2" x2="1200" y2="2" stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
          <line x1="0" y1="398" x2="1200" y2="398" stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
          <line x1="100" y1="0" x2="100" y2="400" stroke="#ffffff" strokeWidth="4" />
          <line x1="1100" y1="0" x2="1100" y2="400" stroke="#ffffff" strokeWidth="4" />

          {/* 10-Yard Markings & Large Bold Numbers (78% Larger for Big Displays) */}
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
                  y2="400"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                {/* Top Yard Numbers */}
                <text
                  x={x}
                  y="54"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="30"
                  fontWeight="900"
                  fontFamily="var(--font-display)"
                  textAnchor="middle"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))' }}
                >
                  {showArrow && yardVal > 50 && <tspan fontSize="18">{arrowDir} </tspan>}
                  {displayNum}
                  {showArrow && yardVal < 50 && <tspan fontSize="18"> {arrowDir}</tspan>}
                </text>
                {/* Bottom Yard Numbers */}
                <text
                  x={x}
                  y="360"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="30"
                  fontWeight="900"
                  fontFamily="var(--font-display)"
                  textAnchor="middle"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))' }}
                >
                  {showArrow && yardVal > 50 && <tspan fontSize="18">{arrowDir} </tspan>}
                  {displayNum}
                  {showArrow && yardVal < 50 && <tspan fontSize="18"> {arrowDir}</tspan>}
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
              y2="400"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              strokeDasharray="6,5"
            />
          ))}

          {/* Hash Marks (Sharp, clean 4-tier NFL hash lines) */}
          {Array.from({ length: 99 }, (_, i) => i + 1)
            .filter((y) => y % 5 !== 0)
            .map((yard) => {
              const x = 100 + yard * 10
              return (
                <g key={`h-${yard}`} stroke="rgba(255,255,255,0.28)" strokeWidth="1.8">
                  <line x1={x} y1="4" x2={x} y2="18" />
                  <line x1={x} y1="140" x2={x} y2="154" />
                  <line x1={x} y1="246" x2={x} y2="260" />
                  <line x1={x} y1="382" x2={x} y2="396" />
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
                height="400"
                fill="rgba(225, 29, 72, 0.18)"
              />
              <rect
                x={direction === 'right' ? 900 : 100}
                y="0"
                width="200"
                height="400"
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
                  height="400"
                  fill="rgba(234, 179, 8, 0.16)"
                />
              )}

              {/* 1st Down Marker (Yellow Broadcast Line - Only when down > 0) */}
              {isRegularPlay && (
                <>
                  <line
                    x1={firstDownX}
                    y1="0"
                    x2={firstDownX}
                    y2="400"
                    stroke="#eab308"
                    strokeWidth="4"
                    strokeDasharray={isGoalToGo ? '8,4' : undefined}
                    filter="drop-shadow(0 0 6px rgba(234,179,8,0.7))"
                  />

                  {/* Direct 1st Down Label Tag (Intelligently offset to bottom if close to LOS) */}
                  <g transform={`translate(${firstDownBadgeX}, ${firstDownBadgeY})`}>
                    <rect
                      x="-23"
                      y="-11"
                      width="46"
                      height="22"
                      rx="4"
                      fill="#eab308"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                    />
                    <text
                      x="0"
                      y="1.5"
                      fill="#0f172a"
                      fontSize="11"
                      fontWeight="900"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {isGoalToGo ? 'GOAL' : '1ST'}
                    </text>
                  </g>
                </>
              )}

              {/* Line of Scrimmage (Cyan Broadcast Line) */}
              <line
                x1={scrimmageX}
                y1="0"
                x2={scrimmageX}
                y2="400"
                stroke="#38bdf8"
                strokeWidth="4"
                filter="drop-shadow(0 0 6px rgba(56,189,248,0.7))"
              />

              {/* Direct Line of Scrimmage Label (Always at Top) */}
              <g transform={`translate(${losBadgeX}, 20)`}>
                <rect
                  x="-22"
                  y="-11"
                  width="44"
                  height="22"
                  rx="4"
                  fill="#0284c7"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                />
                <text
                  x="0"
                  y="1.5"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  LOS
                </text>
              </g>

              {/* Directional Drive Chevron (Sleek broadcast arrow without cluttering text) */}
              {isRegularPlay && (
                <g>
                  <path
                    d={arrowPathD}
                    fill={`url(#${arrowGradId})`}
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="drop-shadow(0 3px 8px rgba(0,0,0,0.85))"
                  />
                </g>
              )}

              {/* Authentic NFL Pro Football */}
              <g transform={`translate(${scrimmageX}, 200)`}>
                {/* Turf Ground Shadow */}
                <ellipse cx="0" cy="18" rx="26" ry="6" fill="rgba(0,0,0,0.6)" filter="blur(1.5px)" />

                {/* Tactical Radar Pulse Ring */}
                <circle cx="0" cy="0" r="30" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.8" />

                {/* Pro Leather Football Body */}
                <path
                  d="M -26,0 C -22,-15 -8,-15 0,-15 C 8,-15 22,-15 26,0 C 22,15 8,15 0,15 C -8,15 -22,15 -26,0 Z"
                  fill={`url(#${ballGradId})`}
                  stroke="#270e02"
                  strokeWidth="1.6"
                  filter="drop-shadow(0 4px 8px rgba(0,0,0,0.8))"
                />

                {/* White Pro Tip Stripes */}
                <path d="M -18,-11 C -15,-5 -15,5 -18,11" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.95" />
                <path d="M 18,-11 C 15,-5 15,5 18,11" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.95" />

                {/* White NFL Seam & Laces */}
                <line x1="-11" y1="0" x2="11" y2="0" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="-7" y1="-3.5" x2="-7" y2="3.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="-3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="3.5" y1="-3.5" x2="3.5" y2="3.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="7" y1="-3.5" x2="7" y2="3.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
              </g>
            </>
          )}

          {/* Halftime Intermission Banner on Field */}
          {isHalftime && (
            <g transform="translate(600, 200)">
              <rect
                x="-150"
                y="-27"
                width="300"
                height="54"
                rx="10"
                fill="#090d16"
                stroke="#f59e0b"
                strokeWidth="2"
                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.8))"
              />
              <text
                x="0"
                y="-4"
                fill="#fbbf24"
                fontSize="15"
                fontWeight="900"
                fontFamily="var(--font-display)"
                letterSpacing="1.5"
                textAnchor="middle"
              >
                ⏸️ AT HALFTIME
              </text>
              <text
                x="0"
                y="16"
                fill="#cbd5e1"
                fontSize="11"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                2nd Half Kickoff Upcoming
              </text>
            </g>
          )}

          {/* Clear Inactive/Scheduled state */}
          {!hasSituation && (
            <g transform="translate(600, 200)">
              <rect
                x="-160"
                y="-28"
                width="320"
                height="56"
                rx="10"
                fill="#090d16"
                fillOpacity="0.95"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1.5"
                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.8))"
              />
              <text
                x="0"
                y="-4"
                fill="#ffffff"
                fontSize="14"
                fontWeight="800"
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
                y="16"
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
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
          <div className="flex items-center gap-2 min-w-0">
            {isHalftime ? (
              <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                <span>⏸️</span>
                <span>AT HALFTIME</span>
              </span>
            ) : hasSituation ? (
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                <strong className="text-amber-300 font-bold shrink-0">
                  {formatDownAndDistance(situation)}
                </strong>
              </span>
            ) : (
              <span className="text-slate-400">{gameStatusDetail || 'Pregame'}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {isRegularPlay && (
              <span className="text-slate-400 text-[10px] hidden sm:inline">
                {isGoalToGo ? 'Goal to Go' : `Target: +${distance}y`}
              </span>
            )}
            <span className="text-[10px] font-bold text-amber-400 tracking-wider">
              {direction === 'right' ? `${offensiveAbbr} ➔` : `◀ ${offensiveAbbr}`}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#080d16] px-3.5 py-2 text-xs text-slate-400">
          <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-sky-400 shrink-0" />
              <strong className="text-slate-300">Scrimmage:</strong> {isHalftime ? 'At Halftime' : hasSituation ? losLabel : '50 YD'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-yellow-400 shrink-0" />
              <strong className="text-slate-300">Target Line:</strong>{' '}
              {isHalftime ? '2nd Half Kickoff' : isRegularPlay ? firstDownLabel : hasSituation ? 'Kickoff / PAT' : '10 Yds'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
