import React, { memo } from 'react'
import type { NFLEvent, GameFilter } from '../types/nfl'
import { isRedZoneSituation, getWeekLabel, formatLocalizedKickoff, sanitizePatriotsAbbreviation } from '../utils/nflHelpers'
import { Flame, Compass, ArrowRight, Zap } from 'lucide-react'

interface SlateBriefingProps {
  events: NFLEvent[]
  seasonType: number
  weekNumber: number
  seasonYear: number
  activeFilter?: GameFilter
  onSelectFilter?: (filter: GameFilter) => void
  onSpotlightEvent?: (eventId: string) => void
}

export const SlateBriefing: React.FC<SlateBriefingProps> = memo(({
  events,
  seasonType,
  weekNumber,
  seasonYear: _seasonYear,
  activeFilter: _activeFilter,
  onSelectFilter: _onSelectFilter,
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

  // Find closest final game for retrospective recap narrative (prioritizing OT or 1-score nail-biters)
  const closestFinalGame = finalEvents.slice().sort((a, b) => {
    const getDiff = (ev: NFLEvent) => {
      const comp = ev.competitions?.[0]
      const h = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
      const aw = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
      return Math.abs(h - aw)
    }
    const aIsOT = (a.status?.type?.detail || a.competitions?.[0]?.status?.type?.detail || '').includes('OT')
    const bIsOT = (b.status?.type?.detail || b.competitions?.[0]?.status?.type?.detail || '').includes('OT')
    if (aIsOT && !bIsOT) return -1
    if (!aIsOT && bIsOT) return 1
    return getDiff(a) - getDiff(b)
  })[0]

  // Find the primary storyline game: 4th quarter thriller > red zone threat > closest live > closest final > upcoming
  const primeAlertEvent = fourthQuarterThrillers[0] || redZoneEvents[0] || closestLiveGame || liveEvents[0] || closestFinalGame || upcomingEvents[0] || finalEvents[0]
  const primeComp = primeAlertEvent?.competitions?.[0]
  const primeHome = primeComp?.competitors?.find((c) => c.homeAway === 'home')
  const primeAway = primeComp?.competitors?.find((c) => c.homeAway === 'away')
  const primeHomeAbbr = sanitizePatriotsAbbreviation(primeHome?.team?.abbreviation) || 'Home'
  const primeAwayAbbr = sanitizePatriotsAbbreviation(primeAway?.team?.abbreviation) || 'Away'

  return (
    <section
      aria-label="Slate Executive Briefing"
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c1424] p-4 sm:p-6 shadow-md"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Narrative Orientation: Answer the core question immediately */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[11px] font-bold text-sky-300 uppercase tracking-wider">
              <Zap className="h-3 w-3 text-sky-400" />
              SLATE BRIEFING
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">
              {weekLabel} Overview
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex flex-wrap items-center gap-2">
            {fourthQuarterThrillers.length > 0 ? (
              <span className="flex items-center gap-1.5 text-amber-300">
                <Flame className="h-4 w-4 text-amber-400 fill-amber-400 animate-pulse" />
                4th Quarter Thriller: {primeAwayAbbr} vs {primeHomeAbbr}
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
              <span className="flex items-center gap-1.5 text-slate-200">
                <span>🏆</span>
                <span>
                  {closestFinalGame && (closestFinalGame.status?.type?.detail || '').includes('OT')
                    ? `${weekLabel} Final • OT Thriller: ${primeAwayAbbr} vs ${primeHomeAbbr}`
                    : `${weekLabel} Final • All ${finalEvents.length} Games Concluded`}
                </span>
              </span>
            )}
          </h2>

          {/* Prime Storyline Callout */}
          {primeAlertEvent && (
            <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-400">
                {finalEvents.length === events.length && events.length > 0 ? 'Slate Result:' : 'Key Matchup:'}
              </span>
              <span className="text-white font-medium">
                {primeAwayAbbr} ({primeAway?.score ?? '-'}) @ {primeHomeAbbr} ({primeHome?.score ?? '-'})
              </span>
              {fourthQuarterThrillers.includes(primeAlertEvent) ? (
                <span className="text-amber-300 font-semibold">• One-score drama with {primeAlertEvent.status?.displayClock} remaining</span>
              ) : redZoneEvents.includes(primeAlertEvent) ? (
                <span className="text-rose-400 font-semibold">• Red Zone Threat</span>
              ) : liveEvents.includes(primeAlertEvent) ? (
                <span className="text-emerald-400 font-medium">• Q{primeAlertEvent.status?.period} {primeAlertEvent.status?.displayClock}</span>
              ) : upcomingEvents.includes(primeAlertEvent) ? (
                <span className="text-sky-300 font-medium">• Kickoff {formatLocalizedKickoff(primeAlertEvent.date)}</span>
              ) : (
                <span className="text-slate-300 font-medium">• Final: {primeAlertEvent.status?.type?.detail || 'Completed'}</span>
              )}
            </p>
          )}
        </div>

        {/* Executive Action: Direct Spotlight Route */}
        {primeAlertEvent && onSpotlightEvent && (
          <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.06] shrink-0">
            <button
              onClick={() => onSpotlightEvent(primeAlertEvent.id)}
              className="flex items-center gap-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 px-3 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-sky-400" />
              <span>Inspect in Spotlight Radar</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
})
