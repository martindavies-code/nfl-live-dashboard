import React, { memo } from 'react'
import type { NFLEvent, GameFilter } from '../types/nfl'
import { isRedZoneSituation, isHalftimeSituation, getWeekLabel, formatLocalizedKickoff, sanitizePatriotsAbbreviation } from '../utils/nflHelpers'
import { Radio, Flame, Pause, Compass, ArrowRight, Zap } from 'lucide-react'

interface SlateBriefingProps {
  events: NFLEvent[]
  seasonType: number
  weekNumber: number
  seasonYear: number
  activeFilter: GameFilter
  onSelectFilter: (filter: GameFilter) => void
  onSpotlightEvent?: (eventId: string) => void
}

export const SlateBriefing: React.FC<SlateBriefingProps> = memo(({
  events,
  seasonType,
  weekNumber,
  seasonYear: _seasonYear,
  activeFilter,
  onSelectFilter,
  onSpotlightEvent,
}) => {
  const weekLabel = getWeekLabel(seasonType, weekNumber)

  // Derive situational intelligence across the entire slate
  const liveEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return (e.status?.type?.state || comp?.status?.type?.state) === 'in'
  })

  const redZoneEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return isRedZoneSituation(comp?.situation, e.status || comp?.status, comp?.competitors || [])
  })

  const halftimeEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return isHalftimeSituation(e.status || comp?.status, comp?.situation)
  })

  const upcomingEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return (e.status?.type?.state || comp?.status?.type?.state) === 'pre'
  })

  const finalEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return (e.status?.type?.state || comp?.status?.type?.state) === 'post'
  })

  // Detect 4th-quarter one-score thrillers (<= 8 points margin in Q4 or OT)
  const fourthQuarterThrillers = liveEvents.filter((ev) => {
    const period = ev.status?.period ?? 0
    if (period < 4) return false
    const comp = ev.competitions?.[0]
    const homeScore = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
    const awayScore = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
    return Math.abs(homeScore - awayScore) <= 8
  })

  // Find closest live game by score differential
  const closestLiveGame = liveEvents.slice().sort((a, b) => {
    const getDiff = (ev: NFLEvent) => {
      const comp = ev.competitions?.[0]
      const h = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
      const aw = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
      return Math.abs(h - aw)
    }
    return getDiff(a) - getDiff(b)
  })[0]

  // Find the primary storyline game: 4th quarter thriller > red zone threat > closest live > premier upcoming
  const primeAlertEvent = fourthQuarterThrillers[0] || redZoneEvents[0] || closestLiveGame || liveEvents[0] || upcomingEvents[0] || finalEvents[0]
  const primeComp = primeAlertEvent?.competitions?.[0]
  const primeHome = primeComp?.competitors?.find((c) => c.homeAway === 'home')
  const primeAway = primeComp?.competitors?.find((c) => c.homeAway === 'away')
  const primeHomeAbbr = sanitizePatriotsAbbreviation(primeHome?.team?.abbreviation) || 'Home'
  const primeAwayAbbr = sanitizePatriotsAbbreviation(primeAway?.team?.abbreviation) || 'Away'

  return (
    <section
      aria-label="Slate Executive Briefing and Navigation Pathways"
      className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-[#0c1426] via-[#090e1c] to-[#0a1022] p-4 sm:p-5 shadow-xl shadow-black/50"
    >
      {/* Radiant Top Specular Highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Narrative Orientation (Kucharski Reason #1: Answer the core question immediately) */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs font-bold text-sky-300 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-sky-400" />
              SLATE BRIEFING
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {weekLabel} • {events.length} Matchups
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex flex-wrap items-center gap-2">
            {fourthQuarterThrillers.length > 0 ? (
              <span className="flex items-center gap-1.5 text-amber-300">
                <Flame className="h-4 w-4 text-amber-400 fill-amber-400 animate-pulse" />
                4th Quarter Thriller in Progress: {primeAwayAbbr} vs {primeHomeAbbr}
              </span>
            ) : liveEvents.length > 0 ? (
              <>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  {liveEvents.length} {liveEvents.length === 1 ? 'Game Live' : 'Games Live'}
                </span>
                {redZoneEvents.length > 0 && (
                  <span className="text-amber-400 flex items-center gap-1">
                    • <Flame className="h-4 w-4 text-rose-400 fill-rose-400 animate-pulse" />
                    {redZoneEvents.length} in Red Zone
                  </span>
                )}
              </>
            ) : upcomingEvents.length > 0 ? (
              <span>Upcoming Slate: Next Kickoff at {formatLocalizedKickoff(upcomingEvents[0]?.date)}</span>
            ) : (
              <span>{weekLabel} Complete: All {finalEvents.length} Games Final</span>
            )}
          </h2>

          {/* Prime Storyline Callout */}
          {primeAlertEvent && (
            <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-400">Headline Action:</span>
              <span className="text-white font-medium">
                {primeAwayAbbr} ({primeAway?.score ?? '-'}) @ {primeHomeAbbr} ({primeHome?.score ?? '-'})
              </span>
              {fourthQuarterThrillers.includes(primeAlertEvent) ? (
                <span className="text-amber-300 font-semibold">• One-score drama with {primeAlertEvent.status?.displayClock} left</span>
              ) : redZoneEvents.includes(primeAlertEvent) ? (
                <span className="text-rose-400 font-semibold">• Active Red Zone Threat</span>
              ) : liveEvents.includes(primeAlertEvent) ? (
                <span className="text-emerald-400 font-medium">• Q{primeAlertEvent.status?.period} {primeAlertEvent.status?.displayClock}</span>
              ) : upcomingEvents.includes(primeAlertEvent) ? (
                <span className="text-sky-300 font-medium">• Kickoff {formatLocalizedKickoff(primeAlertEvent.date)}</span>
              ) : (
                <span className="text-slate-400 font-medium">• Final: {primeAlertEvent.status?.type?.detail || 'Completed'}</span>
              )}
              {onSpotlightEvent && (
                <button
                  onClick={() => onSpotlightEvent(primeAlertEvent.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 ml-1 cursor-pointer"
                >
                  Spotlight in Radar <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </p>
          )}
        </div>

        {/* Guided Journey Action Pathways */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.06] shrink-0">
          {/* Live Action Quick Route */}
          {liveEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('live')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all shrink-0 whitespace-nowrap min-h-[34px] cursor-pointer ${
                activeFilter === 'live'
                  ? 'bg-rose-600 text-white shadow-md ring-1 ring-white/20'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-500/40 hover:bg-rose-900/50'
              }`}
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>
                <span className="sm:hidden">Live</span>
                <span className="hidden sm:inline">Live Action</span> ({liveEvents.length})
              </span>
            </button>
          )}

          {/* Red Zone Scoring Drives Quick Route */}
          {redZoneEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('redzone')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all shrink-0 whitespace-nowrap min-h-[34px] cursor-pointer ${
                activeFilter === 'redzone'
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md ring-1 ring-white/20'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/50'
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-rose-400 fill-rose-400 animate-pulse" />
              <span>Red Zone ({redZoneEvents.length})</span>
            </button>
          )}

          {/* Halftime Quick Route */}
          {halftimeEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('halftime')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all shrink-0 whitespace-nowrap min-h-[34px] cursor-pointer ${
                activeFilter === 'halftime'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-amber-950/30 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40'
              }`}
            >
              <Pause className="h-3.5 w-3.5" />
              <span>
                <span className="sm:hidden">Half</span>
                <span className="hidden sm:inline">Halftime</span> ({halftimeEvents.length})
              </span>
            </button>
          )}

          {/* All Matchups Route */}
          <button
            onClick={() => onSelectFilter('all')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all shrink-0 whitespace-nowrap min-h-[34px] cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-700 text-white shadow-sm ring-1 ring-white/20'
                : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-slate-400" />
            <span>
              <span className="sm:hidden">All</span>
              <span className="hidden sm:inline">All Games</span> ({events.length})
            </span>
          </button>
        </div>
      </div>
    </section>
  )
})
