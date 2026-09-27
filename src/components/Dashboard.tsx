import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { GameFilter, NFLScoreboardData, NFLEvent } from '../types/nfl'
import { fetchNFLScoreboard, getMockLiveGames } from '../services/espnApi'
import { HeroMatchup } from './HeroMatchup'
import { GameCard } from './GameCard'
import {
  RefreshCw,
  Search,
  Sparkles,
  AlertTriangle,
  WifiOff,
  X,
  Flame,
} from 'lucide-react'

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<NFLScoreboardData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<GameFilter>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [countdown, setCountdown] = useState<number>(10)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [useDemoMode, setUseDemoMode] = useState<boolean>(false)
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const [autoRedZoneSpotlight, setAutoRedZoneSpotlight] = useState<boolean>(true)
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const abortControllerRef = useRef<AbortController | null>(null)
  // Always-current reference to loadData so event listeners never capture stale closures
  const loadDataRef = useRef<((isManual?: boolean) => void) | null>(null)

  // Network online/offline listener — uses loadDataRef to always call latest version
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      loadDataRef.current?.(true)
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, []) // stable — no deps needed thanks to loadDataRef

  // Fetch function with AbortController and resilience
  const loadData = useCallback(async (isManual = false) => {
    if (!navigator.onLine && !useDemoMode) {
      setIsOnline(false)
      return
    }

    if (isManual) setIsRefreshing(true)
    setError(null)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      if (useDemoMode) {
        const mockEvents = getMockLiveGames()
        setData({
          events: mockEvents,
          week: { number: 4 },
          season: { year: 2026, type: 2 },
        })
        setLastUpdated(new Date())
        setCountdown(10)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      const scoreboard = await fetchNFLScoreboard(controller.signal)
      setData(scoreboard)
      setLastUpdated(new Date())
      setCountdown(10)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error fetching scoreboard:', err)
        setError(err?.message || 'Failed to fetch live games from ESPN API')
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [useDemoMode])

  // Keep loadDataRef in sync with the latest loadData so stable event listeners always call the current version
  useEffect(() => {
    loadDataRef.current = loadData
  })

  // Polling setup with Page Visibility awareness (battery & network preservation)
  // Countdown is synced to the same interval as the poll to prevent drift.
  useEffect(() => {
    loadData()

    let pollInterval: ReturnType<typeof setInterval> | null = null
    let tickInterval: ReturnType<typeof setInterval> | null = null

    const startTimers = () => {
      if (pollInterval) clearInterval(pollInterval)
      if (tickInterval) clearInterval(tickInterval)

      // Reset countdown when timers (re)start so tick and poll are always aligned
      setCountdown(10)

      pollInterval = setInterval(() => {
        loadData()
        setCountdown(10)
      }, 10000)

      // Tick fires every second; countdown never drifts below 1 before poll resets it
      tickInterval = setInterval(() => {
        setCountdown((prev) => (prev > 1 ? prev - 1 : 1))
      }, 1000)
    }

    const stopTimers = () => {
      if (pollInterval) clearInterval(pollInterval)
      if (tickInterval) clearInterval(tickInterval)
      pollInterval = null
      tickInterval = null
    }

    startTimers()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(true)
        startTimers()
      } else {
        stopTimers()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopTimers()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadData])

  const events = data?.events || []

  // Sanitized filtered and searched events
  const filteredEvents = (() => {
    const cleanQuery = searchQuery.trim().toLowerCase()

    return events.filter((ev) => {
      const comp = ev.competitions?.[0]
      const state = ev.status?.type?.state || comp?.status?.type?.state || 'pre'

      if (filter === 'live' && state !== 'in') return false
      if (filter === 'redzone') {
        const isLive = state === 'in'
        const isRz = Boolean(comp?.situation?.isRedZone)
        if (!isLive || !isRz) return false
      }
      if (filter === 'upcoming' && state !== 'pre') return false
      if (filter === 'final' && state !== 'post') return false

      if (cleanQuery) {
        const home = comp?.competitors?.find((c) => c.homeAway === 'home')
        const away = comp?.competitors?.find((c) => c.homeAway === 'away')
        const matchesName = (ev.name || '').toLowerCase().includes(cleanQuery)
        const matchesShort = (ev.shortName || '').toLowerCase().includes(cleanQuery)
        const matchesHome =
          (home?.team?.displayName || '').toLowerCase().includes(cleanQuery) ||
          (home?.team?.abbreviation || '').toLowerCase().includes(cleanQuery)
        const matchesAway =
          (away?.team?.displayName || '').toLowerCase().includes(cleanQuery) ||
          (away?.team?.abbreviation || '').toLowerCase().includes(cleanQuery)

        if (!matchesName && !matchesShort && !matchesHome && !matchesAway) {
          return false
        }
      }

      return true
    })
  })()

  // Identify the premier game for the Hero Spotlight
  const heroMatchup: NFLEvent | null = (() => {
    if (events.length === 0) return null

    // 1. If autoRedZoneSpotlight is active, dynamically follow any live Red Zone scoring threat!
    if (autoRedZoneSpotlight) {
      const rzGame = events.find((e) => {
        const comp = e.competitions?.[0]
        const isLive = (e.status?.type?.state || comp?.status?.type?.state) === 'in'
        return isLive && comp?.situation?.isRedZone
      })
      if (rzGame) return rzGame
    }

    // 2. User pinned matchup
    if (selectedHeroId) {
      const found = events.find((e) => e.id === selectedHeroId)
      if (found) return found
    }

    // 3. Fallback to any live game
    const liveGame = events.find((e) => {
      const comp = e.competitions?.[0]
      return (e.status?.type?.state || comp?.status?.type?.state) === 'in'
    })
    if (liveGame) return liveGame

    return events[0]
  })()

  // Track if current hero is being spotlighted due to auto-redzone
  const isAutoSelectedRedZone = Boolean(
    autoRedZoneSpotlight &&
    heroMatchup &&
    heroMatchup.competitions?.[0]?.situation?.isRedZone &&
    ((heroMatchup.status?.type?.state || heroMatchup.competitions?.[0]?.status?.type?.state) === 'in')
  )

  const liveCount = events.filter(
    (e) => (e.status?.type?.state || e.competitions?.[0]?.status?.type?.state) === 'in'
  ).length

  const redZoneCount = events.filter((e) => {
    const comp = e.competitions?.[0]
    const isLive = (e.status?.type?.state || comp?.status?.type?.state) === 'in'
    return isLive && comp?.situation?.isRedZone
  }).length

  const upcomingCount = events.filter(
    (e) => (e.status?.type?.state || e.competitions?.[0]?.status?.type?.state) === 'pre'
  ).length

  const finalCount = events.filter(
    (e) => (e.status?.type?.state || e.competitions?.[0]?.status?.type?.state) === 'post'
  ).length

  const weekNumber = data?.week?.number || 1
  const seasonYear = data?.season?.year || 2026

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* OFFLINE STATUS BANNER */}
      {!isOnline && (
        <div
          className="bg-amber-600/90 text-white text-xs py-2 px-4 text-center flex items-center justify-center gap-2 font-medium"
          role="status"
        >
          <WifiOff className="h-4 w-4" />
          <span>You are currently offline. Showing cached scoreboard data. Reconnecting automatically...</span>
        </div>
      )}

      {/* HEADER: Sleek, Purposeful, Zero Redundant Clutter */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090d16]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo & Season Context */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-800 shadow-md ring-1 ring-white/20 select-none"
                aria-hidden="true"
              >
                <span className="text-xl">🏈</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-['Oswald'] font-bold text-xl tracking-wide text-white uppercase">
                    NFL Live Command
                  </h1>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                    W{weekNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {seasonYear} Regular Season • Real-Time Field Tracker
                </p>
              </div>
            </div>

            {/* Context & Polling Status */}
            <div className="flex items-center gap-3">
              {/* Simulation Mode Toggle */}
              <button
                onClick={() => {
                  setUseDemoMode((prev) => !prev)
                  setSelectedHeroId(null)
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                  useDemoMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#111927] text-slate-400 border border-white/[0.08] hover:text-white'
                }`}
                title="Toggle simulated sequence to test live field animations and drive updates"
                aria-pressed={useDemoMode}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">
                  {useDemoMode ? 'Demo Active' : 'Simulation Mode'}
                </span>
              </button>

              {/* Polling countdown badge */}
              <div
                className="hidden md:flex items-center gap-2 rounded-lg bg-[#111927] border border-white/[0.08] px-3 py-1.5 text-xs select-none"
                role="status"
                aria-live="polite"
              >
                <div className="relative flex h-2 w-2 items-center justify-center">
                  {liveCount > 0 && (
                    <span className="absolute h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping" />
                  )}
                  <span
                    className={`h-2 w-2 rounded-full ${
                      liveCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <span className="text-slate-300 font-mono text-[11px] tabular-nums">
                  Sync in <strong className="text-white">{countdown}s</strong>
                </span>
              </div>

              {/* Manual Refresh Button */}
              <button
                onClick={() => {
                  setCountdown(10)
                  loadData(true)
                }}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-lg bg-[#162032] hover:bg-[#1e2c45] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all border border-white/[0.08] active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-sky-400"
                title="Force refresh live scoreboard"
                aria-label="Refresh scoreboard data"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-sky-400 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Error notification banner */}
        {error && (
          <div
            className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-300"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="rounded bg-rose-800/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* SECTION 1: HERO SPOTLIGHT */}
        {!isLoading && heroMatchup && (
          <HeroMatchup
            event={heroMatchup}
            autoRedZone={autoRedZoneSpotlight}
            onToggleAutoRedZone={() => setAutoRedZoneSpotlight((prev) => !prev)}
            isAutoSelectedRedZone={isAutoSelectedRedZone}
          />
        )}

        {/* SECTION 2: SLATE DIRECTORY TOOLBAR */}
        <section className="space-y-4" aria-labelledby="all-matchups-title">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
            <div>
              <h2
                id="all-matchups-title"
                className="font-['Oswald'] text-lg font-bold uppercase tracking-wide text-white"
              >
                All Matchups
              </h2>
              <p className="text-xs text-slate-400">
                Click Spotlight on any matchup to inspect its tactical field radar above
              </p>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 rounded-lg bg-[#111927] p-1 border border-white/[0.08]"
                role="tablist"
                aria-label="Filter games by state"
              >
                <button
                  role="tab"
                  aria-selected={filter === 'all'}
                  onClick={() => setFilter('all')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none ${
                    filter === 'all'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({events.length})
                </button>
                <button
                  role="tab"
                  aria-selected={filter === 'live'}
                  onClick={() => setFilter('live')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none ${
                    filter === 'live'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {liveCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />}
                  Live ({liveCount})
                </button>
                <button
                  role="tab"
                  aria-selected={filter === 'redzone'}
                  onClick={() => setFilter('redzone')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none ${
                    filter === 'redzone'
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className={`h-3 w-3 ${filter === 'redzone' ? 'text-amber-300 fill-amber-300' : redZoneCount > 0 ? 'text-rose-400 fill-rose-400 animate-pulse' : 'text-slate-400'}`} />
                  <span>Red Zone ({redZoneCount})</span>
                </button>
                <button
                  role="tab"
                  aria-selected={filter === 'upcoming'}
                  onClick={() => setFilter('upcoming')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none ${
                    filter === 'upcoming'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upcoming ({upcomingCount})
                </button>
                <button
                  role="tab"
                  aria-selected={filter === 'final'}
                  onClick={() => setFilter('final')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none ${
                    filter === 'final'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Final ({finalCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[200px]" role="search">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchQuery('')
                  }}
                  placeholder="Filter team..."
                  aria-label="Filter teams by name or city"
                  className="w-full rounded-lg border border-white/[0.08] bg-[#111927] pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={`skel-${idx}`}
                  className="h-64 rounded-xl border border-white/[0.06] bg-[#0c121e] animate-pulse p-4 flex flex-col justify-between"
                >
                  <div className="h-5 w-1/3 bg-slate-800 rounded" />
                  <div className="space-y-3">
                    <div className="h-8 bg-slate-800/80 rounded" />
                    <div className="h-8 bg-slate-800/80 rounded" />
                  </div>
                  <div className="h-4 bg-slate-800/50 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Empty Search / Filter State */}
          {!isLoading && filteredEvents.length === 0 && (
            <div className="my-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#0c121e]/50 p-10 text-center">
              <span className="text-3xl mb-2">{filter === 'redzone' ? '🔥' : '🏈'}</span>
              <h3 className="text-sm font-bold text-white">
                {filter === 'redzone' ? 'No Games Currently in the Red Zone' : 'No Matchups Found'}
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                {filter === 'redzone'
                  ? 'No teams are currently driving inside the 20-yard line. Games will automatically appear here the moment an offense crosses the 20, or toggle Simulation Mode to watch a live drive!'
                  : filter === 'live'
                  ? 'No games are currently in progress right now. Try switching to "All" or toggle Simulation Mode to preview live field animations.'
                  : 'No games match your query.'}
              </p>
              <button
                onClick={() => {
                  setFilter('all')
                  setSearchQuery('')
                }}
                className="mt-3 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
              >
                Show All Games
              </button>
            </div>
          )}

          {/* GAME CARDS GRID */}
          {!isLoading && filteredEvents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredEvents.map((event) => (
                <GameCard
                  key={event.id}
                  event={event}
                  isSpotlighted={heroMatchup?.id === event.id}
                  onSpotlight={() => {
                    setSelectedHeroId(event.id)
                    setAutoRedZoneSpotlight(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-white/[0.06] bg-[#070b14] py-4 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NFL Live Command • Real-Time Field Tracker & Scoreboard</span>
          <span>Last sync: {lastUpdated.toLocaleTimeString()} • Sourced from ESPN API</span>
        </div>
      </footer>
    </div>
  )
}
