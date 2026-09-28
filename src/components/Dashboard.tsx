import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { GameFilter, NFLScoreboardData, NFLEvent } from '../types/nfl'
import { WeekSelector } from './WeekSelector'
import {
  isRedZoneSituation,
  isHalftimeSituation,
  getSeasonPhaseDescription,
  getWeekLabel,
  getNextWeek,
  getPrevWeek,
} from '../utils/nflHelpers'
import { fetchNFLScoreboard, getMockLiveGames, type ScoreboardQueryParams } from '../services/espnApi'
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
  Pause,
  Volume2,
  VolumeX,
  Eye,
  Keyboard,
  Compass,
} from 'lucide-react'
import { playRedZoneSound, playScoreChime, playTactileClick } from '../utils/audioFeedback'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'

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
  const [showAllFieldRadars, setShowAllFieldRadars] = useState<boolean>(false)

  // NFL Season & Week Navigation States (Regular Season W1-18 & Postseason/Playoffs)
  const [selectedSeasonType, setSelectedSeasonType] = useState<number>(2)
  const [selectedWeek, setSelectedWeek] = useState<number>(4)
  const [liveSeasonType, setLiveSeasonType] = useState<number>(2)
  const [liveWeek, setLiveWeek] = useState<number>(4)
  const [hasUserSelectedWeek, setHasUserSelectedWeek] = useState<boolean>(false)

  // 2026 Premier Accessibility & Audio States
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nfl_muted') === 'true'
    } catch {
      return false
    }
  })
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nfl_high_contrast') === 'true'
    } catch {
      return false
    }
  })
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false)
  const [srAnnouncement, setSrAnnouncement] = useState<string>('')

  const prevRedZoneSetRef = useRef<Set<string>>(new Set())
  const prevScoresMapRef = useRef<Map<string, string>>(new Map())
  const searchInputRef = useRef<HTMLInputElement>(null)

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
  const loadData = useCallback(async (isManual = false, overrideSeasonType?: number, overrideWeek?: number) => {
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

    const targetSeasonType = overrideSeasonType ?? selectedSeasonType
    const targetWeek = overrideWeek ?? selectedWeek
    const isTargetingLive = !overrideSeasonType ? !hasUserSelectedWeek : (targetSeasonType === liveSeasonType && targetWeek === liveWeek)

    try {
      if (useDemoMode) {
        const mockEvents = getMockLiveGames(targetSeasonType, targetWeek)
        setData({
          events: mockEvents,
          week: { number: targetWeek },
          season: { year: 2026, type: targetSeasonType },
        })
        setLastUpdated(new Date())
        setCountdown(10)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      const params: ScoreboardQueryParams | undefined = !isTargetingLive
        ? { seasonType: targetSeasonType, week: targetWeek }
        : undefined

      const scoreboard = await fetchNFLScoreboard(params, controller.signal)
      setData(scoreboard)

      // If user hasn't explicitly chosen a different week, sync to current live week
      if (scoreboard.week?.number && isTargetingLive) {
        setLiveWeek(scoreboard.week.number)
        setSelectedWeek(scoreboard.week.number)
      }
      if (scoreboard.season?.type && isTargetingLive) {
        setLiveSeasonType(scoreboard.season.type)
        setSelectedSeasonType(scoreboard.season.type)
      }

      setLastUpdated(new Date())
      setCountdown(10)
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (!isAbort) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch live games from ESPN API'
        console.error('Error fetching scoreboard:', err)
        setError(errorMsg)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [useDemoMode, selectedSeasonType, selectedWeek, hasUserSelectedWeek, liveSeasonType, liveWeek])

  const handleSelectWeek = useCallback(
    (seasonType: number, weekNumber: number) => {
      const isLive = seasonType === liveSeasonType && weekNumber === liveWeek
      setHasUserSelectedWeek(!isLive)
      setSelectedSeasonType(seasonType)
      setSelectedWeek(weekNumber)
      setSelectedHeroId(null)
      setIsLoading(true)
      playTactileClick(isMuted)
      setSrAnnouncement(`Navigated to ${getWeekLabel(seasonType, weekNumber)}`)
      loadData(true, seasonType, weekNumber)
    },
    [liveSeasonType, liveWeek, isMuted, loadData]
  )

  // Keep loadDataRef in sync with the latest loadData so stable event listeners always call the current version
  useEffect(() => {
    loadDataRef.current = loadData
  })

  // Polling setup with Page Visibility awareness (battery & network preservation)
  // Countdown is synced to the same interval as the poll to prevent drift.
  useEffect(() => {
    queueMicrotask(() => {
      loadData()
    })

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
        const isRz = isRedZoneSituation(comp?.situation, ev.status || comp?.status, comp?.competitors || [])
        if (!isRz) return false
      }
      if (filter === 'halftime') {
        const isHalf = isHalftimeSituation(ev.status || comp?.status, comp?.situation)
        if (!isHalf) return false
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
        return isRedZoneSituation(comp?.situation, e.status || comp?.status, comp?.competitors || [])
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
    isRedZoneSituation(
      heroMatchup.competitions?.[0]?.situation,
      heroMatchup.status || heroMatchup.competitions?.[0]?.status,
      heroMatchup.competitions?.[0]?.competitors || []
    )
  )

  // Audio cue and screen reader announcement triggers on live events
  useEffect(() => {
    if (!data?.events) return

    const currentRzSet = new Set<string>()
    let newRzFound = false
    let newScoreFound = false
    let scoreAnnouncement = ''
    let rzAnnouncement = ''

    for (const ev of data.events) {
      const comp = ev.competitions?.[0]
      const isRz = isRedZoneSituation(comp?.situation, ev.status || comp?.status, comp?.competitors || [])
      if (isRz) {
        currentRzSet.add(ev.id)
        if (!prevRedZoneSetRef.current.has(ev.id)) {
          newRzFound = true
          const offAbbr = comp?.situation?.possessionText || ev.shortName || 'Team'
          rzAnnouncement = `Red zone alert: ${offAbbr} is driving inside the 20-yard line!`
        }
      }

      // Check scores
      const home = comp?.competitors?.find((c) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c) => c.homeAway === 'away')
      const scoreKey = `${home?.score || 0}-${away?.score || 0}`
      const prevScore = prevScoresMapRef.current.get(ev.id)
      if (prevScore && prevScore !== scoreKey) {
        newScoreFound = true
        scoreAnnouncement = `Score update: ${ev.shortName || ev.name}, ${home?.team?.abbreviation || 'Home'} ${home?.score || 0}, ${away?.team?.abbreviation || 'Away'} ${away?.score || 0}.`
      }
      prevScoresMapRef.current.set(ev.id, scoreKey)
    }

    prevRedZoneSetRef.current = currentRzSet

    if (newRzFound) {
      playRedZoneSound(isMuted)
      setTimeout(() => setSrAnnouncement(rzAnnouncement), 0)
    } else if (newScoreFound) {
      playScoreChime(isMuted)
      setTimeout(() => setSrAnnouncement(scoreAnnouncement), 0)
    }
  }, [data, isMuted])

  // Sound cues toggle handler
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nfl_muted', String(next))
      } catch {}
      if (!next) playTactileClick(false)
      setSrAnnouncement(next ? 'Sound cues muted' : 'Sound cues active')
      return next
    })
  }, [])

  // High contrast pro mode toggle handler
  const toggleHighContrast = useCallback(() => {
    setIsHighContrast((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nfl_high_contrast', String(next))
      } catch {}
      playTactileClick(isMuted)
      setSrAnnouncement(next ? 'High Contrast Pro mode enabled' : 'High Contrast Pro mode disabled')
      return next
    })
  }, [isMuted])

  // Sync high-contrast-pro class to root element
  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast-pro')
    } else {
      document.documentElement.classList.remove('high-contrast-pro')
    }
  }, [isHighContrast])

  // Global Keyboard Shortcuts (WCAG 2.1.1 Keyboard Navigation & Power User Ergonomics)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          setSearchQuery('')
          ;(e.target as HTMLElement).blur()
        }
        return
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setIsShortcutsOpen((prev) => !prev)
        return
      }

      if (e.key === 'Escape') {
        setIsShortcutsOpen(false)
        setSearchQuery('')
        return
      }

      if (e.key === '1') {
        setFilter('all')
        setSrAnnouncement('Filter changed: Showing all matchups')
      } else if (e.key === '2') {
        setFilter('live')
        setSrAnnouncement('Filter changed: Showing live games')
      } else if (e.key === '3') {
        setFilter('redzone')
        setSrAnnouncement('Filter changed: Showing Red Zone games')
      } else if (e.key === '4') {
        setFilter('halftime')
        setSrAnnouncement('Filter changed: Showing halftime games')
      } else if (e.key === '5') {
        setFilter('upcoming')
        setSrAnnouncement('Filter changed: Showing upcoming games')
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setCountdown(10)
        playTactileClick(isMuted)
        loadData(true)
        setSrAnnouncement('Refreshing live scores')
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        setUseDemoMode((prev) => !prev)
        setSelectedHeroId(null)
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setAutoRedZoneSpotlight((prev) => !prev)
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        toggleMute()
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault()
        toggleHighContrast()
      } else if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === '[') {
        e.preventDefault()
        const prev = getPrevWeek(selectedSeasonType, selectedWeek)
        handleSelectWeek(prev.seasonType, prev.weekNumber)
      } else if (e.key === ']') {
        e.preventDefault()
        const next = getNextWeek(selectedSeasonType, selectedWeek)
        handleSelectWeek(next.seasonType, next.weekNumber)
      } else if (e.key === '0' || e.key.toLowerCase() === 'w') {
        e.preventDefault()
        handleSelectWeek(liveSeasonType, liveWeek)
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handleSelectWeek(3, 5) // Jump to Super Bowl / Playoffs
      } else if (e.key.toLowerCase() === 'j') {
        if (filteredEvents.length > 0) {
          const currentIndex = filteredEvents.findIndex((ev) => ev.id === heroMatchup?.id)
          const nextIndex = (currentIndex + 1) % filteredEvents.length
          setSelectedHeroId(filteredEvents[nextIndex].id)
          setAutoRedZoneSpotlight(false)
          setSrAnnouncement(`Spotlighted ${filteredEvents[nextIndex].name}`)
        }
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowAllFieldRadars((prev) => {
          const next = !prev
          playTactileClick(isMuted)
          setSrAnnouncement(next ? 'All 100-yard field radars expanded' : 'All field radars collapsed')
          return next
        })
      } else if (e.key.toLowerCase() === 'k') {
        if (filteredEvents.length > 0) {
          const currentIndex = filteredEvents.findIndex((ev) => ev.id === heroMatchup?.id)
          const prevIndex = (currentIndex - 1 + filteredEvents.length) % filteredEvents.length
          setSelectedHeroId(filteredEvents[prevIndex].id)
          setAutoRedZoneSpotlight(false)
          setSrAnnouncement(`Spotlighted ${filteredEvents[prevIndex].name}`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    filteredEvents,
    heroMatchup,
    isMuted,
    loadData,
    toggleHighContrast,
    toggleMute,
    handleSelectWeek,
    selectedSeasonType,
    selectedWeek,
    liveSeasonType,
    liveWeek,
  ])

  const liveCount = events.filter(
    (e) => (e.status?.type?.state || e.competitions?.[0]?.status?.type?.state) === 'in'
  ).length

  const redZoneCount = events.filter((e) => {
    const comp = e.competitions?.[0]
    return isRedZoneSituation(comp?.situation, e.status || comp?.status, comp?.competitors || [])
  }).length

  const halftimeCount = events.filter((e) => {
    const comp = e.competitions?.[0]
    return isHalftimeSituation(e.status || comp?.status, comp?.situation)
  }).length

  const upcomingCount = events.filter(
    (e) => (e.status?.type?.state || e.competitions?.[0]?.status?.type?.state) === 'pre'
  ).length

  const finalCount = events.filter(
    (e) => (e.status?.type?.state || e.competitions?.[0]?.status?.type?.state) === 'post'
  ).length

  const seasonYear = data?.season?.year || 2026

  return (
    <div className={`min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] ${isHighContrast ? 'high-contrast-pro' : ''}`}>
      {/* Screen Reader Live Announcer */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      {/* Skip to Main Content Link for Keyboard and Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-sky-500 focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white focus:shadow-2xl focus:ring-2 focus:ring-white focus:outline-none"
      >
        Skip to main content
      </a>

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
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-['Oswald'] font-bold text-xl tracking-wide text-white uppercase shrink-0">
                    NFL Live Command
                  </h1>
                  <WeekSelector
                    currentSeasonType={selectedSeasonType}
                    currentWeek={selectedWeek}
                    liveSeasonType={liveSeasonType}
                    liveWeek={liveWeek}
                    seasonYear={seasonYear}
                    onSelectWeek={handleSelectWeek}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {getSeasonPhaseDescription(selectedSeasonType, seasonYear, selectedWeek)} • Real-Time Field Tracker
                </p>
              </div>
            </div>

            {/* Context & Polling Status */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* High Contrast Pro Toggle */}
              <button
                onClick={toggleHighContrast}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                  isHighContrast
                    ? 'bg-amber-400 text-black border border-amber-300'
                    : 'bg-[#111927] text-slate-400 border border-white/[0.08] hover:text-white'
                }`}
                title="Toggle High-Contrast Pro Mode (Shortcut: H)"
                aria-pressed={isHighContrast}
                aria-label={isHighContrast ? "High Contrast Mode Active. Click to disable." : "Enable High Contrast Mode"}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1 hidden xl:inline">
                  {isHighContrast ? 'Contrast ON' : 'Contrast'}
                </span>
              </button>

              {/* Sound Cues Toggle */}
              <button
                onClick={toggleMute}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                  !isMuted
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-[#111927] text-slate-400 border border-white/[0.08] hover:text-white'
                }`}
                title="Toggle Audio Feedback Cues (Shortcut: M)"
                aria-pressed={!isMuted}
                aria-label={isMuted ? "Sound Cues Muted. Click to unmute." : "Sound Cues Active. Click to mute."}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-sky-400" />}
                <span className="sr-only sm:not-sr-only sm:ml-1 hidden xl:inline">
                  {isMuted ? 'Muted' : 'Audio On'}
                </span>
              </button>

              {/* Keyboard Shortcuts Help Button */}
              <button
                onClick={() => setIsShortcutsOpen(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#111927] hover:bg-[#162032] border border-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                title="Keyboard Shortcuts & Accessibility Info (Shortcut: ?)"
                aria-label="Open Keyboard Shortcuts and Accessibility Guide"
              >
                <Keyboard className="h-4 w-4 text-indigo-400" />
                <span className="sr-only sm:not-sr-only sm:ml-1 hidden xl:inline">Help (?)</span>
              </button>

              {/* Simulation Mode Toggle */}
              <button
                onClick={() => {
                  setUseDemoMode((prev) => !prev)
                  setSelectedHeroId(null)
                }}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  useDemoMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#111927] text-slate-400 border border-white/[0.08] hover:text-white'
                }`}
                title="Toggle simulated sequence to test live field animations and drive updates"
                aria-pressed={useDemoMode}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">
                  {useDemoMode ? 'Demo Active' : 'Simulation'}
                </span>
              </button>

              {/* Polling countdown badge */}
              <div
                className="hidden md:flex min-h-[44px] items-center gap-2 rounded-lg bg-[#111927] border border-white/[0.08] px-3 py-1.5 text-xs select-none"
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
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#162032] hover:bg-[#1e2c45] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all border border-white/[0.08] active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-8 focus:outline-none">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseDemoMode(true)}
                className="rounded bg-emerald-700/80 hover:bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors shadow-sm"
              >
                Launch Simulation
              </button>
              <button
                onClick={() => loadData(true)}
                className="rounded bg-rose-800/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                Retry Sync
              </button>
            </div>
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
                Click any matchup to select and inspect its tactical radar above • Red Zone threats highlighted in red
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
                  aria-selected={filter === 'halftime'}
                  onClick={() => setFilter('halftime')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none ${
                    filter === 'halftime'
                      ? 'bg-amber-600 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Pause className={`h-3 w-3 ${filter === 'halftime' ? 'text-amber-200 fill-amber-200' : halftimeCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>At Halftime ({halftimeCount})</span>
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

              {/* Expand All / Collapse All Field Radars Toggle */}
              <button
                onClick={() => {
                  setShowAllFieldRadars((prev) => {
                    const next = !prev
                    playTactileClick(isMuted)
                    setSrAnnouncement(next ? 'All field radars expanded' : 'All field radars collapsed')
                    return next
                  })
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border focus:outline-none focus:ring-2 focus:ring-sky-400 min-h-[36px] ${
                  showAllFieldRadars
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                    : 'bg-[#111927] text-slate-400 border-white/[0.08] hover:text-white'
                }`}
                title="Toggle 100-yard field radar for all matchups (Shortcut: F)"
                aria-pressed={showAllFieldRadars}
              >
                <Compass className={`h-3.5 w-3.5 ${showAllFieldRadars ? 'text-sky-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">
                  {showAllFieldRadars ? 'Hide All Radars' : 'Expand All Radars'}
                </span>
                <span className="sm:hidden">
                  {showAllFieldRadars ? 'Hide Radars' : 'All Radars'}
                </span>
              </button>

              {/* Search Bar */}
              <div className="relative min-w-[180px] sm:min-w-[200px]" role="search">
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
                  className="w-full rounded-lg border border-white/[0.08] bg-[#111927] pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none min-h-[36px]"
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
              <span className="text-3xl mb-2">{filter === 'redzone' ? '🔥' : filter === 'halftime' ? '⏸️' : '🏈'}</span>
              <h3 className="text-sm font-bold text-white">
                {filter === 'redzone'
                  ? 'No Games Currently in the Red Zone'
                  : filter === 'halftime'
                  ? 'No Games Currently at Halftime'
                  : 'No Matchups Found'}
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                {filter === 'redzone'
                  ? 'No teams are currently driving inside the 20-yard line. Games will automatically appear here the moment an offense crosses the 20, or toggle Simulation Mode to watch a live drive!'
                  : filter === 'halftime'
                  ? 'No games are currently in intermission between the 2nd and 3rd quarters. Games will appear here automatically when the 2nd quarter clock reaches 0:00.'
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
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
                  showField={showAllFieldRadars}
                  onToggleAllRadars={() => setShowAllFieldRadars((prev) => !prev)}
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

      {/* Keyboard Shortcuts & Accessibility Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  )
}
