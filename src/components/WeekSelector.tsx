import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Trophy, Calendar, Radio, X } from 'lucide-react'
import {
  PLAYOFF_ROUNDS,
  REGULAR_SEASON_WEEKS,
  getWeekBadgeText,
  getWeekLabel,
  getNextWeek,
  getPrevWeek,
} from '../utils/nflHelpers'
import { useFocusTrap } from '../utils/useFocusTrap'

export interface WeekSelectorProps {
  currentSeasonType: number
  currentWeek: number
  liveSeasonType: number
  liveWeek: number
  seasonYear: number
  onSelectWeek: (seasonType: number, week: number) => void
  disabled?: boolean
}

export const WeekSelector: React.FC<WeekSelectorProps> = ({
  currentSeasonType,
  currentWeek,
  liveSeasonType,
  liveWeek,
  seasonYear,
  onSelectWeek,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [tabOverride, setTabOverride] = useState<'regular' | 'playoffs' | null>(null)
  const activeTab = tabOverride ?? (currentSeasonType === 3 ? 'playoffs' : 'regular')

  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const popoverRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: () => {
      setIsOpen(false)
      setTabOverride(null)
    },
  })

  const isPlayoffs = currentSeasonType === 3
  const isViewingLiveWeek = currentSeasonType === liveSeasonType && currentWeek === liveWeek

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setTabOverride(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handlePrev = () => {
    if (disabled) return
    const prev = getPrevWeek(currentSeasonType, currentWeek)
    onSelectWeek(prev.seasonType, prev.weekNumber)
  }

  const handleNext = () => {
    if (disabled) return
    const next = getNextWeek(currentSeasonType, currentWeek)
    onSelectWeek(next.seasonType, next.weekNumber)
  }

  const handleSelect = (seasonType: number, week: number) => {
    onSelectWeek(seasonType, week)
    setIsOpen(false)
    setTabOverride(null)
    triggerRef.current?.focus()
  }

  const handleReturnToLive = () => {
    onSelectWeek(liveSeasonType, liveWeek)
    setIsOpen(false)
    setTabOverride(null)
  }

  const isAtFirst = currentSeasonType === 2 && currentWeek === 1
  const isAtLast = currentSeasonType === 3 && currentWeek === 5

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      {/* Week Navigation Capsule */}
      <div className="flex items-center gap-1 bg-[#111927] border border-white/[0.12] rounded-lg p-0.5 shadow-sm">
        {/* Previous Week Button */}
        <button
          onClick={handlePrev}
          disabled={disabled || isAtFirst}
          title="Previous week (Shortcut: [)"
          aria-label="Previous NFL Week"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Main Week Dropdown Trigger */}
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Current week: ${getWeekLabel(currentSeasonType, currentWeek)}. Click to change week or view playoffs.`}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-sky-400 ${
            isPlayoffs
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              : isViewingLiveWeek
                ? 'bg-white/10 text-slate-200 hover:bg-white/15 border border-white/[0.08]'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30'
          }`}
        >
          {isPlayoffs ? (
            <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          ) : (
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span className="tracking-wide">{getWeekBadgeText(currentSeasonType, currentWeek)}</span>
          <ChevronDown
            className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Next Week Button */}
        <button
          onClick={handleNext}
          disabled={disabled || isAtLast}
          title="Next week (Shortcut: ])"
          aria-label="Next NFL Week"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* "Return to Live" Quick Button (Shown when user is looking at past or future weeks) */}
      {!isViewingLiveWeek && (
        <button
          onClick={handleReturnToLive}
          title="Jump directly to current live week (Shortcut: 0 or W)"
          aria-label={`Jump back to Live Week ${liveWeek}`}
          className="ml-2 hidden sm:flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/30 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 animate-pulse"
        >
          <Radio className="h-3 w-3 text-red-400 shrink-0" />
          <span>Live: W{liveWeek}</span>
        </button>
      )}

      {/* Week & Playoff Selector Popover Dropdown */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label="Select NFL Week or Playoff Round"
          className="absolute left-0 top-full mt-2 z-50 w-[340px] sm:w-[380px] rounded-xl bg-[#0d1422] border border-white/[0.15] shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="font-['Oswald'] font-bold text-sm uppercase tracking-wide text-white">
                {seasonYear} NFL Calendar
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-400">
                {isPlayoffs ? 'Postseason' : 'Regular Season'}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close week selector"
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented Season Tabs */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-[#070b13] p-1 border border-white/[0.06]">
            <button
              onClick={() => setTabOverride('regular')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                activeTab === 'regular'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Regular Season</span>
            </button>

            <button
              onClick={() => setTabOverride('playoffs')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                activeTab === 'playoffs'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>NFL Playoffs</span>
            </button>
          </div>

          {/* Tab Content: Regular Season Weeks (1 - 18) */}
          {activeTab === 'regular' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
                <span>Select Week (1–18):</span>
                {liveSeasonType === 2 && (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Week {liveWeek} is Live
                  </span>
                )}
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {REGULAR_SEASON_WEEKS.map((w) => {
                  const isSelected = currentSeasonType === 2 && currentWeek === w
                  const isLive = liveSeasonType === 2 && liveWeek === w
                  const isPast = w < liveWeek

                  return (
                    <button
                      key={w}
                      onClick={() => handleSelect(2, w)}
                      aria-label={`Week ${w}${isSelected ? ' (selected)' : ''}${isLive ? ' (live now)' : ''}`}
                      className={`relative flex flex-col items-center justify-center py-2 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-sky-500 text-slate-950 font-black shadow-lg shadow-sky-500/30 ring-2 ring-sky-300'
                          : isLive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : isPast
                              ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-white border border-white/[0.06]'
                              : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-white/[0.04]'
                      }`}
                    >
                      <span>W{w}</span>
                      {isLive && (
                        <span className="text-[9px] font-black uppercase text-emerald-400">Live</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tab Content: NFL Playoffs (5 Rounds) */}
          {activeTab === 'playoffs' && (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] text-slate-400 mb-1 px-1">
                Select Playoff Round or Super Bowl:
              </div>

              {PLAYOFF_ROUNDS.map((round) => {
                const isSelected = currentSeasonType === 3 && currentWeek === round.weekNumber
                const isSuperBowl = round.weekNumber === 5

                return (
                  <button
                    key={round.weekNumber}
                    onClick={() => handleSelect(3, round.weekNumber)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all border ${
                      isSelected
                        ? isSuperBowl
                          ? 'bg-gradient-to-r from-amber-600/40 to-yellow-500/30 border-amber-400 text-white shadow-lg ring-1 ring-amber-300'
                          : 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-md ring-1 ring-sky-300'
                        : isSuperBowl
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0" aria-hidden="true">
                        {round.icon}
                      </span>
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>{round.name}</span>
                          {isSuperBowl && (
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400 text-black">
                              Lombardi Trophy
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{round.detail}</p>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.08] text-slate-300">
                      Round {round.weekNumber}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Popover Footer with Quick Return */}
          <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
            <button
              onClick={handleReturnToLive}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Radio className="h-3 w-3" />
              <span>Reset to Current Live Week (W{liveWeek})</span>
            </button>
            <span className="text-[10px] text-slate-500">Keys: [ / ]</span>
          </div>
        </div>
      )}
    </div>
  )
}
