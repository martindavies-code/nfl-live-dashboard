import React, { useState, memo } from 'react'
import type { NFLEvent } from '../types/nfl'
import { FieldDiagram } from './FieldDiagram'
import { WinProbabilityBar } from './WinProbabilityBar'
import { formatDownAndDistance, getOffensiveDrive, safeParseInt } from '../utils/nflHelpers'
import { 
  Tv, 
  Flame, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Activity,
  Maximize2,
  Sparkles
} from 'lucide-react'
import { getScorigamiInfo, getGameSecondsRemaining } from '../utils/scorigami'

interface GameCardProps {
  event: NFLEvent
  isSpotlighted?: boolean
  onSpotlight?: () => void
}

const DEFAULT_NFL_LOGO = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png'

export const GameCard: React.FC<GameCardProps> = memo(({ 
  event, 
  isSpotlighted = false,
  onSpotlight 
}) => {
  const [showField, setShowField] = useState(false)

  const competition = event.competitions?.[0]
  if (!competition) return null

  const competitors = competition.competitors || []
  const homeComp = competitors.find((c) => c.homeAway === 'home') || competitors[0]
  const awayComp = competitors.find((c) => c.homeAway === 'away') || competitors[1]

  const status = event.status || competition.status
  const state = status?.type?.state || 'pre' // 'pre' | 'in' | 'post'
  const isLive = state === 'in'
  const isFinal = state === 'post'

  const situation = competition.situation

  // Derive true regulation seconds remaining for accurate scorigami probability
  const secondsLeft = getGameSecondsRemaining(status, state)
  const homeAbbr = homeComp?.team?.abbreviation || 'Home'
  const awayAbbr = awayComp?.team?.abbreviation || 'Away'
  const scorigamiInfo = getScorigamiInfo(
    safeParseInt(homeComp?.score, 0),
    safeParseInt(awayComp?.score, 0),
    secondsLeft,
    state,
    homeAbbr,
    awayAbbr
  )

  // Check possession with helper (only active during live games)
  const { isHomePossession, isAwayPossession } = getOffensiveDrive(
    isLive ? situation : null,
    competitors
  )

  const broadcastNetwork =
    competition.broadcasts?.[0]?.names?.join(', ') ||
    (event as any).broadcast

  // Format kick-off date for pre-game
  const formattedKickoff = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  const downAndDistance = formatDownAndDistance(situation)

  const homeTimeouts = typeof situation?.homeTimeouts === 'number' ? situation.homeTimeouts : 3
  const awayTimeouts = typeof situation?.awayTimeouts === 'number' ? situation.awayTimeouts : 3

  return (
    <article
      className={`group relative flex flex-col rounded-xl border transition-all duration-200 overflow-hidden ${
        isSpotlighted
          ? 'ring-2 ring-emerald-500/70 border-emerald-500/50 bg-[#101726]'
          : isLive
          ? 'border-white/[0.12] bg-[#0e1524] hover:border-white/[0.22] hover:bg-[#11192b]'
          : 'border-white/[0.05] bg-[#0a0f1b]/80 opacity-90 hover:opacity-100 hover:border-white/[0.12]'
      }`}
    >
      {/* CARD HEADER */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#070b14] px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
              LIVE
            </span>
          ) : isFinal ? (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
              FINAL
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-sky-950/60 px-2 py-0.5 text-[11px] font-medium text-sky-300 border border-sky-800/30">
              <Clock className="h-3 w-3" />
              {formattedKickoff}
            </span>
          )}

          {isLive && (
            <div className="flex items-center gap-1 font-mono text-xs font-bold text-white">
              <span className="text-slate-400">Q{status.period}</span>
              <span className="text-emerald-400 tabular-nums">{status.displayClock}</span>
            </div>
          )}

          {isFinal && status.type?.detail && (
            <span className="text-[11px] text-slate-400 font-medium">
              {status.type.detail}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLive && situation?.isRedZone && (
            <span className="inline-flex items-center gap-0.5 rounded bg-rose-600/20 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
              <Flame className="h-3 w-3 text-rose-400 fill-rose-400" />
              RZ
            </span>
          )}

          {broadcastNetwork && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Tv className="h-3 w-3 text-slate-500" />
              {broadcastNetwork}
            </span>
          )}

          {/* Spotlight Button */}
          {onSpotlight && !isSpotlighted && (
            <button
              onClick={onSpotlight}
              className="flex items-center gap-1 rounded bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
              title="Pin this matchup to the Spotlight Radar at the top"
              aria-label={`Spotlight ${awayComp?.team?.name} at ${homeComp?.team?.name}`}
            >
              <Maximize2 className="h-3 w-3" />
              <span className="hidden md:inline">Spotlight</span>
            </button>
          )}
        </div>
      </div>

      {/* TEAMS & SCORES */}
      <div className="p-4 space-y-3">
        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 flex-shrink-0">
              <img
                src={awayComp?.team?.logo || DEFAULT_NFL_LOGO}
                alt={awayComp?.team?.displayName || 'Away Team'}
                className="h-full w-full object-contain filter drop-shadow-sm"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = DEFAULT_NFL_LOGO
                }}
              />
              {isLive && isAwayPossession && (
                <span
                  className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px]"
                  title="Possession"
                >
                  🏈
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-sm text-white truncate">
                  {awayComp?.team?.displayName || awayComp?.team?.name}
                </span>
                <span className="font-mono text-xs text-slate-400 font-semibold shrink-0">
                  {awayComp?.team?.abbreviation}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{awayComp?.records?.[0]?.summary || '0-0'}</span>
                {isLive && (
                  <div className="flex items-center gap-0.5 ml-1" title={`${awayTimeouts} timeouts remaining`}>
                    {[1, 2, 3].map((num) => (
                      <span
                        key={`card-away-to-${num}`}
                        className={`h-1.5 w-1.5 rounded-full ${
                          num <= awayTimeouts ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="font-['Oswald'] text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums shrink-0 ml-3">
            {awayComp?.score ?? '-'}
          </span>
        </div>

        {/* Home Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-9 w-9 flex-shrink-0">
              <img
                src={homeComp?.team?.logo || DEFAULT_NFL_LOGO}
                alt={homeComp?.team?.displayName || 'Home Team'}
                className="h-full w-full object-contain filter drop-shadow-sm"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = DEFAULT_NFL_LOGO
                }}
              />
              {isLive && isHomePossession && (
                <span
                  className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px]"
                  title="Possession"
                >
                  🏈
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-sm text-white truncate">
                  {homeComp?.team?.displayName || homeComp?.team?.name}
                </span>
                <span className="font-mono text-xs text-slate-400 font-semibold shrink-0">
                  {homeComp?.team?.abbreviation}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{homeComp?.records?.[0]?.summary || '0-0'}</span>
                {isLive && (
                  <div className="flex items-center gap-0.5 ml-1" title={`${homeTimeouts} timeouts remaining`}>
                    {[1, 2, 3].map((num) => (
                      <span
                        key={`card-home-to-${num}`}
                        className={`h-1.5 w-1.5 rounded-full ${
                          num <= homeTimeouts ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="font-['Oswald'] text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums shrink-0 ml-3">
            {homeComp?.score ?? '-'}
          </span>
        </div>
      </div>

      {/* Situational Callout Strip */}
      {isLive && downAndDistance && (
        <div className="mx-4 mb-3 rounded-lg border border-white/[0.06] bg-[#070c16] px-3 py-2 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 shrink-0">
            <Activity className="h-3 w-3 text-sky-400" />
            <span className="font-mono font-bold text-amber-300">
              {downAndDistance}
            </span>
          </div>
          {situation?.possession && situation?.possessionText && (
            <span className="text-[11px] text-slate-400 truncate text-right">
              Ball on <strong className="text-white">{situation.possessionText}</strong>
            </span>
          )}
        </div>
      )}

      {/* In-place Win Probability Bar */}
      <div className="px-4 pb-3">
        <WinProbabilityBar
          homeWinPercentage={situation?.lastPlay?.probability?.homeWinPercentage}
          awayWinPercentage={situation?.lastPlay?.probability?.awayWinPercentage}
          homeCompetitor={homeComp}
          awayCompetitor={awayComp}
          gameState={state}
          status={status}
          situation={situation}
          odds={competition.odds}
        />
        {/* Scorigami Novelty & Projection Section */}
        <div
          className={`mt-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
            scorigamiInfo.isCurrentScorigami
              ? 'border-violet-500/50 bg-gradient-to-r from-violet-950/70 to-purple-950/60 text-violet-200 shadow-sm shadow-violet-950/50'
              : 'border-white/[0.08] bg-[#070c16] text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5 mb-1.5">
            <span className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-[10px] text-slate-400">
              <Sparkles className={`h-3 w-3 ${scorigamiInfo.isCurrentScorigami ? 'text-violet-400 animate-pulse' : 'text-slate-500'}`} />
              {scorigamiInfo.isCurrentScorigami ? '✨ Active Scorigami' : 'Scorigami Chance'}
            </span>
            <span
              className={`font-mono font-bold text-xs tabular-nums px-1.5 py-0.5 rounded ${
                scorigamiInfo.isCurrentScorigami
                  ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40'
                  : 'bg-white/[0.04] text-slate-300'
              }`}
            >
              {scorigamiInfo.chanceLabel}
            </span>
          </div>

          {scorigamiInfo.mostLikelyNovel && (
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
              <span className="text-slate-400">Most Likely Scorigami:</span>
              <strong className="font-mono text-xs font-bold text-violet-300 bg-violet-950/60 px-1.5 py-0.5 rounded border border-violet-800/40">
                {scorigamiInfo.mostLikelyLabel}
              </strong>
            </div>
          )}

          <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-300">When: </span>
            {scorigamiInfo.whenScenario}
          </div>
        </div>
      </div>

      {/* Expandable Field Radar Toggle */}
      <div className="border-t border-white/[0.06] bg-[#070b14] px-4 py-2">
        <button
          onClick={() => setShowField(!showField)}
          className="flex w-full items-center justify-between text-xs text-slate-400 hover:text-white transition-colors focus:outline-none"
          aria-expanded={showField}
        >
          <span className="font-semibold text-[11px] uppercase tracking-wider">
            {showField ? 'Hide Field Radar' : 'View Field Radar'}
          </span>
          {showField ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showField && (
          <div className="pt-3 pb-1">
            <FieldDiagram
              situation={situation}
              competitors={competitors}
              gameState={state}
              gameStatusDetail={status?.type?.detail}
            />
          </div>
        )}
      </div>
    </article>
  )
})
