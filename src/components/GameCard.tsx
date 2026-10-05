import React, { useState, memo } from 'react'
import type { NFLEvent } from '../types/nfl'
import { FieldDiagram } from './FieldDiagram'
import { WinProbabilityBar } from './WinProbabilityBar'
import { formatDownAndDistance, getOffensiveDrive, safeParseInt, isRedZoneSituation, isHalftimeSituation, formatLocalizedKickoff, getWeekLabel, sanitizePatriotsAbbreviation } from '../utils/nflHelpers'
import { 
  Flame, 
  Clock, 
  Activity,
  Maximize2,
  Sparkles,
  Pause,
  Compass,
  Trophy,
  Mic,
  Check,
} from 'lucide-react'
import { getScorigamiInfo, getGameSecondsRemaining } from '../utils/scorigami'
import { getGameBroadcastDetails } from '../utils/broadcastInfo'

interface GameCardProps {
  event: NFLEvent
  isSpotlighted?: boolean
  onSpotlight?: () => void
  showField?: boolean
  globalExpandedTab?: 'radar' | 'broadcast' | 'scorigami' | null
  onToggleAllRadars?: () => void
}

const DEFAULT_NFL_LOGO = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png'

export const GameCard: React.FC<GameCardProps> = memo(({ 
  event, 
  isSpotlighted = false,
  onSpotlight,
  showField: controlledShowField,
  globalExpandedTab,
  onToggleAllRadars
}) => {
  const [prevGlobalTab, setPrevGlobalTab] = useState(globalExpandedTab)
  const [localTab, setLocalTab] = useState<'radar' | 'broadcast' | 'scorigami' | null | undefined>(undefined)

  // Reset local override when dashboard global expanded tab changes
  if (globalExpandedTab !== prevGlobalTab) {
    setPrevGlobalTab(globalExpandedTab)
    setLocalTab(undefined)
  }

  const activeTab = localTab !== undefined ? localTab : (globalExpandedTab ?? (controlledShowField ? 'radar' : null))
  const isRadarActive = activeTab === 'radar'
  const isBroadcastActive = activeTab === 'broadcast'
  const isScorigamiActive = activeTab === 'scorigami'

  const handleToggleTab = (tab: 'radar' | 'broadcast' | 'scorigami', e: React.MouseEvent) => {
    e.stopPropagation()
    if (tab === 'radar' && onToggleAllRadars && controlledShowField !== undefined && globalExpandedTab === undefined) {
      onToggleAllRadars()
      return
    }
    setLocalTab((prev) => {
      const current = prev !== undefined ? prev : (globalExpandedTab ?? (controlledShowField ? 'radar' : null))
      return current === tab ? null : tab
    })
  }

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
  const drivePlays = event.drivePlays || competition.drives?.current?.plays

  // Derive true regulation seconds remaining for accurate scorigami probability
  const secondsLeft = getGameSecondsRemaining(status, state)
  const homeAbbr = sanitizePatriotsAbbreviation(homeComp?.team?.abbreviation) || 'Home'
  const awayAbbr = sanitizePatriotsAbbreviation(awayComp?.team?.abbreviation) || 'Away'
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

  const isRedZone = isRedZoneSituation(situation, status, competitors)
  const isHalftime = isHalftimeSituation(status, situation)

  // Format kick-off date for pre-game localized to user's timezone
  const formattedKickoff = formatLocalizedKickoff(event.date)

  const downAndDistance = formatDownAndDistance(situation)

  const homeTimeouts = typeof situation?.homeTimeouts === 'number' && Number.isFinite(situation.homeTimeouts) ? situation.homeTimeouts : 3
  const awayTimeouts = typeof situation?.awayTimeouts === 'number' && Number.isFinite(situation.awayTimeouts) ? situation.awayTimeouts : 3

  const fieldPanelId = `field-panel-${event.id}`
  const broadcastPanelId = `broadcast-panel-${event.id}`
  const scorigamiPanelId = `scorigami-panel-${event.id}`
  const broadcastDetails = getGameBroadcastDetails(event)
  const cardAriaLabel = `${awayAbbr} at ${homeAbbr}, ${isLive ? `Live in Quarter ${status.period} with ${status.displayClock} remaining` : isFinal ? 'Final' : formattedKickoff}. Current score: ${awayAbbr} ${awayComp?.score || 0}, ${homeAbbr} ${homeComp?.score || 0}.${isRedZone ? ' Active Red Zone scoring threat!' : ''} US broadcast on ${broadcastDetails.usTv}, ${broadcastDetails.announcers.verified ? `commentary by ${broadcastDetails.announcers.leadDuo}` : 'commentary crew TBD'}.`

  return (
    <article
      onClick={(e) => {
        // Prevent card spotlight click if an interactive element was clicked
        if ((e.target as HTMLElement).closest('button, [role="button"], a, input')) return
        if (onSpotlight && !isSpotlighted) {
          onSpotlight()
        }
      }}
      aria-label={cardAriaLabel}
      className={`group relative flex flex-col h-full rounded-xl transition-all duration-200 overflow-hidden ${
        onSpotlight && !isSpotlighted ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${
        isRedZone
          ? 'card-tier-redzone'
          : isSpotlighted
          ? 'border border-sky-400/90 ring-2 ring-sky-400/80 bg-[#101726] shadow-[0_0_24px_rgba(56,189,248,0.3)]'
          : isHalftime
          ? 'card-tier-halftime'
          : isLive
          ? 'card-tier-live'
          : 'card-tier-dormant'
      }`}
    >
      {/* TOP ACCENT BAR FOR INSTANT PERIPHERAL SCANNING */}
      {isRedZone ? (
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse" />
      ) : isSpotlighted ? (
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 shadow-sm" />
      ) : null}

      {/* CARD HEADER */}
      <div className={`flex items-center justify-between border-b px-4 py-2 text-xs transition-colors ${
        isRedZone && isSpotlighted
          ? 'border-rose-500/30 bg-[#0d0914]'
          : isRedZone
          ? 'border-rose-500/30 bg-[#12080c]'
          : isSpotlighted
          ? 'border-sky-500/30 bg-[#07111e]'
          : 'border-white/[0.06] bg-[#070b14]'
      }`}>
        <div className="flex items-center gap-2">
          {event.season?.type === 3 && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
              <Trophy className="h-3 w-3 text-amber-400" />
              {getWeekLabel(3, event.week?.number)}
            </span>
          )}

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
            isHalftime ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                <Pause className="h-3 w-3 text-amber-400" />
                AT HALFTIME
              </span>
            ) : (
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-white">
                <span className="text-slate-400">Q{status.period}</span>
                <span className="text-emerald-400 tabular-nums">{status.displayClock}</span>
              </div>
            )
          )}

          {isFinal && status.type?.detail && (
            <span className="text-[11px] text-slate-400 font-medium">
              {status.type.detail}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* RED ZONE BADGE */}
          {isLive && isRedZone && (
            <span className="inline-flex items-center gap-1 rounded bg-rose-600/30 border border-rose-500/60 px-2 py-0.5 text-[10px] font-black tracking-wider text-rose-200 animate-pulse shadow-sm shadow-rose-950">
              <Flame className="h-3 w-3 text-rose-400 fill-rose-400" />
              RED ZONE
            </span>
          )}

          {/* SELECTED BADGE */}
          {isSpotlighted && (
            <span className="inline-flex items-center gap-1 rounded bg-sky-500/25 border border-sky-400/60 px-2 py-0.5 text-[10px] font-bold text-sky-200 shadow-sm shadow-sky-950">
              <Sparkles className="h-3 w-3 text-sky-300 fill-sky-300" />
              SPOTLIGHTED
            </span>
          )}

          {/* Spotlight / Select Button */}
          {onSpotlight && !isSpotlighted && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSpotlight()
              }}
              className="flex items-center gap-1 rounded-md bg-white/[0.06] hover:bg-sky-500 hover:text-white px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors border border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-sky-400"
              title="Spotlight this matchup at the top"
              aria-label={`Spotlight ${awayComp?.team?.name} at ${homeComp?.team?.name}`}
            >
              <Maximize2 className="h-3 w-3" />
              <span>Spotlight</span>
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
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-md ring-1 ring-amber-300/80"
                  title="Possession"
                  aria-label="Possession"
                >
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-amber-950 stroke-amber-950" strokeWidth="0.8">
                    <path d="M 2.5,12 C 4.5,5 12,3.5 21.5,2.5 C 20.5,12 19,19.5 12,21.5 C 4.5,20.5 3.5,19 2.5,12 Z" />
                    <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="9" y1="13" x2="13" y2="9" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
                    <line x1="11" y1="15" x2="15" y2="11" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-sm text-white truncate">
                  {awayComp?.team?.displayName || awayComp?.team?.name}
                </span>
                <span className="font-mono text-xs text-slate-400 font-semibold shrink-0">
                  {awayComp?.team?.abbreviation === 'NE' ? 'FNE' : awayComp?.team?.abbreviation}
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
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-md ring-1 ring-amber-300/80"
                  title="Possession"
                  aria-label="Possession"
                >
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-amber-950 stroke-amber-950" strokeWidth="0.8">
                    <path d="M 2.5,12 C 4.5,5 12,3.5 21.5,2.5 C 20.5,12 19,19.5 12,21.5 C 4.5,20.5 3.5,19 2.5,12 Z" />
                    <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="9" y1="13" x2="13" y2="9" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
                    <line x1="11" y1="15" x2="15" y2="11" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-sm text-white truncate">
                  {homeComp?.team?.displayName || homeComp?.team?.name}
                </span>
                <span className="font-mono text-xs text-slate-400 font-semibold shrink-0">
                  {homeComp?.team?.abbreviation === 'NE' ? 'FNE' : homeComp?.team?.abbreviation}
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

      {/* Dynamic Expanded Section: Radar (Hero of Card Body when active) */}
      {isRadarActive ? (
        <div id={fieldPanelId} className="px-3 pb-2.5 pt-0.5" role="region" aria-label="Field position view">
          <FieldDiagram
            situation={situation}
            competitors={competitors}
            gameState={state}
            gameStatusDetail={isHalftime ? 'At Halftime' : status?.type?.detail}
            status={status}
            compact={true}
            drivePlays={drivePlays}
          />
        </div>
      ) : (
        /* Situational Callout Strip (Only rendered when radar is collapsed) */
        isLive && downAndDistance && (
          <div className="mx-4 mb-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-1.5 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
              <Activity className="h-3 w-3 text-sky-400 shrink-0" />
              <span className="font-mono font-bold text-amber-300 truncate">
                {downAndDistance}
              </span>
            </div>
            {isRedZone ? (
              <span className="text-[10px] font-bold text-rose-400 shrink-0 flex items-center gap-1">
                <Flame className="h-3 w-3 fill-rose-400" /> Red Zone
              </span>
            ) : situation?.possession && situation?.possessionText && !downAndDistance.includes(situation.possessionText) ? (
              <span className="text-[11px] text-slate-400 truncate text-right">
                Ball on <strong className="text-white">{situation.possessionText}</strong>
              </span>
            ) : null}
          </div>
        )
      )}

      {/* Dynamic Expanded Section: US Announcing Crew */}
      {isBroadcastActive && (
        <div id={broadcastPanelId} className="mx-3 mb-2 p-2.5 rounded-lg border border-sky-500/20 bg-[#070b14]/95 space-y-2 text-xs" role="region" aria-label="US Announcing crew details">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                <Mic className="h-3 w-3 text-sky-400" />
                {broadcastDetails.usTv}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">US Announcing Crew</span>
            </div>
            {broadcastDetails.announcers.verified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                <Check className="h-2.5 w-2.5" />
                Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-slate-200 pt-0.5 font-medium">
            <span className={broadcastDetails.announcers.verified ? 'text-white font-semibold' : 'text-amber-300/90 italic'}>
              {broadcastDetails.announcers.leadDuo}
            </span>
          </div>
          {broadcastDetails.announcers.sideline && (
            <div className="text-[11px] text-slate-400">
              Sideline: <span className="text-slate-300 font-medium">{broadcastDetails.announcers.sideline}</span>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Expanded Section: Scorigami */}
      {isScorigamiActive && (
        <div id={scorigamiPanelId} className="mx-3 mb-2 p-2.5 rounded-lg border border-indigo-500/20 bg-indigo-950/20 space-y-1.5 text-xs text-slate-300" role="region" aria-label="Scorigami metrics">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-200 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              {scorigamiInfo.isCurrentScorigami ? 'Live Scorigami Active' : 'Scorigami Chance'}
            </span>
            <span className="font-mono font-bold text-xs bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40">
              {scorigamiInfo.chanceLabel}
            </span>
          </div>
          {scorigamiInfo.mostLikelyNovel && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Most Likely:</span>
              <span className="font-mono font-bold text-indigo-200">{scorigamiInfo.mostLikelyLabel}</span>
            </div>
          )}
          <div className="text-[11px] text-slate-400">
            <span className="text-slate-300 font-semibold">Scenario: </span>
            {scorigamiInfo.whenScenario}
          </div>
          {scorigamiInfo.lastGameSummary && (
            <div className="text-[11px] text-slate-400 border-t border-white/[0.04] pt-1">
              Last: <strong className="text-amber-300 font-medium">{scorigamiInfo.lastGameSummary}</strong>
              <span className="text-slate-500 ml-1">({scorigamiInfo.currentOccurrences}x in NFL history)</span>
            </div>
          )}
        </div>
      )}

      {/* In-place Compact Win Probability Bar */}
      <div className="px-4 pb-2.5">
        <WinProbabilityBar
          homeWinPercentage={situation?.lastPlay?.probability?.homeWinPercentage}
          awayWinPercentage={situation?.lastPlay?.probability?.awayWinPercentage}
          homeCompetitor={homeComp}
          awayCompetitor={awayComp}
          gameState={state}
          status={status}
          situation={situation}
          odds={competition.odds}
          compact={true}
        />
      </div>

      {/* Progressive Disclosure Action Toolbar (Anchored at Bottom Edge) */}
      <div className="border-t border-white/[0.05] bg-[#070b14]/70 px-3 py-1.5 mt-auto">
        <div className="flex items-center justify-between gap-1 text-xs">
          {/* Radar Tab */}
          <button
            type="button"
            onClick={(e) => handleToggleTab('radar', e)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 font-medium text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
              isRadarActive
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            aria-expanded={isRadarActive}
            aria-controls={fieldPanelId}
            aria-label={isRadarActive ? `Collapse field radar for ${awayAbbr} at ${homeAbbr}` : `View field radar for ${awayAbbr} at ${homeAbbr}`}
          >
            <Compass className={`h-3 w-3 ${isRadarActive ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>Radar</span>
          </button>

          {/* Broadcast Tab */}
          <button
            type="button"
            onClick={(e) => handleToggleTab('broadcast', e)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 font-medium text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
              isBroadcastActive
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            aria-expanded={isBroadcastActive}
            aria-controls={broadcastPanelId}
            aria-label="View US television announcing crew"
          >
            <Mic className={`h-3 w-3 ${isBroadcastActive ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>Broadcast</span>
          </button>

          {/* Scorigami Tab */}
          <button
            type="button"
            onClick={(e) => handleToggleTab('scorigami', e)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 font-medium text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
              isScorigamiActive
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            aria-expanded={isScorigamiActive}
            aria-controls={scorigamiPanelId}
            aria-label="View historical Scorigami probability and unique score metrics"
          >
            <Sparkles className={`h-3 w-3 ${isScorigamiActive ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
            <span>Scorigami</span>
          </button>
        </div>
      </div>
    </article>
  )
})
