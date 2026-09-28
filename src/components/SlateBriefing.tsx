import React, { memo } from 'react'
import type { NFLEvent, GameFilter } from '../types/nfl'
import { isRedZoneSituation, isHalftimeSituation, getWeekLabel, formatLocalizedKickoff } from '../utils/nflHelpers'
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

  // Find the most dramatic or high-urgency game right now
  const primeAlertEvent = redZoneEvents[0] || liveEvents[0] || upcomingEvents[0]
  const primeComp = primeAlertEvent?.competitions?.[0]
  const primeHome = primeComp?.competitors?.find((c) => c.homeAway === 'home')
  const primeAway = primeComp?.competitors?.find((c) => c.homeAway === 'away')

  return (
    <section
      aria-label="Slate Executive Briefing and Navigation Pathways"
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#0c1322] via-[#0e172a] to-[#0c1322] p-4 sm:p-5 shadow-lg"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Narrative Orientation (Kucharski Reason #1 Fix) */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs font-bold text-sky-300 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-sky-400" />
              SLATE SITUATION BRIEFING
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {weekLabel} • {events.length} Total Matchups
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex flex-wrap items-center gap-2">
            {liveEvents.length > 0 ? (
              <>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  {liveEvents.length} {liveEvents.length === 1 ? 'Game Live Right Now' : 'Games Live in Progress'}
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
              <span className="font-semibold text-slate-400">Featured Action:</span>
              <span className="text-white font-medium">
                {primeAway?.team?.abbreviation || 'Away'} ({primeAway?.score ?? '-'}) @ {primeHome?.team?.abbreviation || 'Home'} ({primeHome?.score ?? '-'})
              </span>
              {redZoneEvents.includes(primeAlertEvent) ? (
                <span className="text-rose-400 font-semibold">• Active Red Zone Threat inside the 20</span>
              ) : liveEvents.includes(primeAlertEvent) ? (
                <span className="text-emerald-400 font-medium">• Q{primeAlertEvent.status?.period} {primeAlertEvent.status?.displayClock}</span>
              ) : (
                <span className="text-sky-300 font-medium">• Kickoff {formatLocalizedKickoff(primeAlertEvent.date)}</span>
              )}
              {onSpotlightEvent && (
                <button
                  onClick={() => onSpotlightEvent(primeAlertEvent.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 ml-1"
                >
                  Inspect in Radar <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </p>
          )}
        </div>

        {/* Guided Journey Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
          {/* Live Action Quick Route */}
          {liveEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('live')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeFilter === 'live'
                  ? 'bg-rose-600 text-white shadow-md ring-1 ring-white/20'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-500/40 hover:bg-rose-900/50'
              }`}
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Live Action ({liveEvents.length})</span>
            </button>
          )}

          {/* Red Zone Scoring Drives Quick Route */}
          {redZoneEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('redzone')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
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
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeFilter === 'halftime'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-amber-950/30 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40'
              }`}
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Halftime ({halftimeEvents.length})</span>
            </button>
          )}

          {/* All Matchups Route */}
          <button
            onClick={() => onSelectFilter('all')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-700 text-white shadow-sm ring-1 ring-white/20'
                : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-slate-400" />
            <span>All Games ({events.length})</span>
          </button>
        </div>
      </div>
    </section>
  )
})
