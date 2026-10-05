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

  // Find the most dramatic or high-urgency game right now
  const primeAlertEvent = redZoneEvents[0] || liveEvents[0] || upcomingEvents[0]
  const primeComp = primeAlertEvent?.competitions?.[0]
  const primeHome = primeComp?.competitors?.find((c) => c.homeAway === 'home')
  const primeAway = primeComp?.competitors?.find((c) => c.homeAway === 'away')

  return (
    <section
      aria-label="Slate Executive Briefing and Navigation Pathways"
      className="relative overflow-hidden rounded-2xl border border-[#d4af37]/30 bg-gradient-to-r from-[#0c0d13] via-[#10121a] to-[#0c0d13] shadow-2xl"
    >
      {/* Hollywood / NFL Films 35mm Clapboard Chevron Bar */}
      <div className="h-2 w-full film-slate-chevron opacity-85" aria-hidden="true" />

      <div className="p-3.5 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Narrative Orientation — NFL Films Cinematic Presentation */}
          <div className="space-y-1 sm:space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#d4af37]/15 border border-[#d4af37]/40 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-[#f6e082] uppercase tracking-[0.16em] font-['Cinzel',serif]">
                <Zap className="h-3 w-3 text-[#d4af37]" />
                NFL FILMS • PRODUCTION SLATE
              </span>
              <span className="text-[11px] sm:text-xs text-amber-200/70 font-mono tracking-wider">
                SCENE: {weekLabel.toUpperCase()} • REEL: {events.length} MATCHUPS
              </span>
            </div>

            <h2 className="text-base sm:text-xl font-['Bebas_Neue','Oswald',sans-serif] tracking-wider text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
              {liveEvents.length > 0 ? (
                <>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    {liveEvents.length} {liveEvents.length === 1 ? 'MATCHUP LIVE ON CELLULOID' : 'MATCHUPS LIVE IN COMBAT'}
                  </span>
                  {redZoneEvents.length > 0 && (
                    <span className="text-rose-400 flex items-center gap-1 font-sans text-xs sm:text-sm font-bold">
                      • <Flame className="h-4 w-4 text-rose-400 fill-rose-400 animate-pulse" />
                      {redZoneEvents.length} in the Red Zone
                    </span>
                  )}
                </>
              ) : upcomingEvents.length > 0 ? (
                <span className="text-slate-100">UPCOMING SLATE: NEXT KICKOFF AT {formatLocalizedKickoff(upcomingEvents[0]?.date).toUpperCase()}</span>
              ) : (
                <span className="text-amber-100">{weekLabel.toUpperCase()} COMPLETE: ALL {finalEvents.length} BATTLES IN THE ARCHIVE</span>
              )}
            </h2>

            {/* Prime Storyline Callout */}
            {primeAlertEvent && (
              <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[#d4af37] uppercase tracking-wider text-[10px]">Marquee Action:</span>
                <span className="text-white font-medium">
                  {sanitizePatriotsAbbreviation(primeAway?.team?.abbreviation) || 'Away'} ({primeAway?.score ?? '-'}) @ {sanitizePatriotsAbbreviation(primeHome?.team?.abbreviation) || 'Home'} ({primeHome?.score ?? '-'})
                </span>
                {redZoneEvents.includes(primeAlertEvent) ? (
                  <span className="text-rose-400 font-semibold">• Active Red Zone Threat</span>
                ) : liveEvents.includes(primeAlertEvent) ? (
                  <span className="text-emerald-400 font-medium">• Q{primeAlertEvent.status?.period} {primeAlertEvent.status?.displayClock}</span>
                ) : (
                  <span className="text-amber-300 font-medium">• Kickoff {formatLocalizedKickoff(primeAlertEvent.date)}</span>
                )}
                {onSpotlightEvent && (
                  <button
                    onClick={() => onSpotlightEvent(primeAlertEvent.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d4af37] hover:text-[#f6e082] underline underline-offset-2 ml-1"
                  >
                    Inspect in Radar <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </p>
            )}
          </div>

        {/* Guided Journey Action Buttons - Responsive Wrapping with Compact Mobile Labels */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
          {/* Live Action Quick Route */}
          {liveEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('live')}
              className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all shrink-0 whitespace-nowrap min-h-[32px] sm:min-h-[36px] ${
                activeFilter === 'live'
                  ? 'bg-rose-600 text-white shadow-md ring-1 ring-white/20'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-500/40 hover:bg-rose-900/50'
              }`}
            >
              <Radio className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-pulse" />
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
              className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all shrink-0 whitespace-nowrap min-h-[32px] sm:min-h-[36px] ${
                activeFilter === 'redzone'
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md ring-1 ring-white/20'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/50'
              }`}
            >
              <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-400 fill-rose-400 animate-pulse" />
              <span>Red Zone ({redZoneEvents.length})</span>
            </button>
          )}

          {/* Halftime Quick Route */}
          {halftimeEvents.length > 0 && (
            <button
              onClick={() => onSelectFilter('halftime')}
              className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-all shrink-0 whitespace-nowrap min-h-[32px] sm:min-h-[36px] ${
                activeFilter === 'halftime'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-amber-950/30 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40'
              }`}
            >
              <Pause className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>
                <span className="sm:hidden">Half</span>
                <span className="hidden sm:inline">Halftime</span> ({halftimeEvents.length})
              </span>
            </button>
          )}

          {/* All Matchups Route */}
          <button
            onClick={() => onSelectFilter('all')}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-all shrink-0 whitespace-nowrap min-h-[32px] sm:min-h-[36px] ${
              activeFilter === 'all'
                ? 'bg-[#d4af37]/25 text-[#f6e082] border border-[#d4af37]/60 shadow-sm'
                : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <Compass className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400" />
            <span>
              <span className="sm:hidden">All</span>
              <span className="hidden sm:inline">All Games</span> ({events.length})
            </span>
          </button>
        </div>
      </div>
      </div>
    </section>
  )
})
