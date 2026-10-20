import React, { useState, useId, useRef, useEffect, useMemo, memo } from 'react'
import type { NFLEvent } from '../types/nfl'
import { FieldDiagram } from './FieldDiagram'
import { WinProbabilityBar } from './WinProbabilityBar'
import {
  formatDownAndDistance,
  getOffensiveDrive,
  safeParseInt,
  isRedZoneSituation,
  isHalftimeSituation,
  getWeekLabel,
  formatLocalizedKickoff,
  sanitizePatriotsAbbreviation,
  sanitizePatriotsName,
  isDarkLogoTeam,
  shouldDisplayLastPlayText,
  sanitizeClipboardField,
} from '../utils/nflHelpers'
import {
  Flame,
  MapPin,
  Compass,
  Sparkles,
  Pause,
  Trophy,
  Share2,
  Check,
  Clock,
  Mic,
  Radio,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { getScorigamiInfo, getGameSecondsRemaining } from '../utils/scorigami'
import { getGameBroadcastDetails } from '../utils/broadcastInfo'
import { sanitizeUrl, FALLBACK_LOGO } from '../utils/normalizer'

export interface HeroMatchupProps {
  readonly event: NFLEvent
  readonly autoRedZone?: boolean
  readonly onToggleAutoRedZone?: () => void
  readonly isAutoSelectedRedZone?: boolean
  readonly threatIndex?: number
  readonly totalThreats?: number
}

export const HeroMatchup: React.FC<HeroMatchupProps> = memo(({
  event,
  autoRedZone = true,
  onToggleAutoRedZone,
  isAutoSelectedRedZone = false,
  threatIndex,
  totalThreats,
}) => {
  const isMultiThreat = Boolean(totalThreats && totalThreats > 1)
  const [isCopied, setIsCopied] = useState(false)
  const [showScorigamiDetails, setShowScorigamiDetails] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactId = useId().replace(/:/g, '')

  // Clean up any pending clipboard reset timeout upon component unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  const competition = event?.competitions?.[0]
  const competitors = competition?.competitors || []
  const homeComp = competitors.find((c) => c.homeAway === 'home') || competitors[0]
  const awayComp = competitors.find((c) => c.homeAway === 'away') || competitors[1]

  const status = event?.status || competition?.status
  const state = status?.type?.state || 'pre'
  const isLive = state === 'in'
  const isFinal = state === 'post'

  const situation = competition?.situation
  const drivePlays = event?.drivePlays || competition?.drives?.current?.plays
  const hasFieldDrivePlays = Boolean(drivePlays && drivePlays.length > 0)

  // Defensive extraction of clock, quarter period, and detail
  const safePeriod = typeof status?.period === 'number' && Number.isFinite(status.period) ? status.period : 1
  const safeClock = typeof status?.displayClock === 'string' && status.displayClock.trim() !== '' ? status.displayClock.trim() : '0:00'
  const safeStatusDetail = status?.type?.detail || (isLive ? `Q${safePeriod} ${safeClock}` : isFinal ? 'Final' : 'Scheduled')

  // Check possession with helper (only active during live games)
  const { isHomePossession, isAwayPossession } = getOffensiveDrive(
    isLive ? situation : null,
    competitors
  )

  const isRedZone = isRedZoneSituation(situation, status, competitors)
  const isHalftime = isHalftimeSituation(status, situation)

  // Strictly clamp timeouts between 0 and 3
  const rawHomeTimeouts = typeof situation?.homeTimeouts === 'number' && Number.isFinite(situation.homeTimeouts) ? situation.homeTimeouts : 3
  const rawAwayTimeouts = typeof situation?.awayTimeouts === 'number' && Number.isFinite(situation.awayTimeouts) ? situation.awayTimeouts : 3
  const homeTimeouts = Math.max(0, Math.min(3, Math.floor(rawHomeTimeouts)))
  const awayTimeouts = Math.max(0, Math.min(3, Math.floor(rawAwayTimeouts)))

  // Robust score parsing and display values
  const rawHomeScore = homeComp?.score
  const rawAwayScore = awayComp?.score
  const homeScoreParsed = safeParseInt(rawHomeScore, 0)
  const awayScoreParsed = safeParseInt(rawAwayScore, 0)
  const homeScoreDisplay = isLive || isFinal ? (rawHomeScore != null && String(rawHomeScore).trim() !== '' ? String(rawHomeScore) : '0') : '—'
  const awayScoreDisplay = isLive || isFinal ? (rawAwayScore != null && String(rawAwayScore).trim() !== '' ? String(rawAwayScore) : '0') : '—'

  const isAwayWinner = isFinal && awayScoreParsed > homeScoreParsed
  const isHomeWinner = isFinal && homeScoreParsed > awayScoreParsed

  // Derive true regulation seconds remaining for accurate scorigami probability
  const secondsLeft = getGameSecondsRemaining(status, state)
  const homeAbbr = sanitizePatriotsAbbreviation(homeComp?.team?.abbreviation) || 'Home'
  const awayAbbr = sanitizePatriotsAbbreviation(awayComp?.team?.abbreviation) || 'Away'

  // Memoize performance-heavy calculations unconditionally before any return
  const scorigamiInfo = useMemo(() => {
    return getScorigamiInfo(
      homeScoreParsed,
      awayScoreParsed,
      secondsLeft,
      state,
      homeAbbr,
      awayAbbr
    )
  }, [homeScoreParsed, awayScoreParsed, secondsLeft, state, homeAbbr, awayAbbr])

  const broadcastDetails = useMemo(() => {
    return getGameBroadcastDetails(event)
  }, [event])

  const venueText = useMemo(() => {
    if (!competition?.venue) return ''
    const name = competition.venue.fullName || ''
    const city = competition.venue.address?.city ? `, ${competition.venue.address.city}` : ''
    return `${name}${city}`.trim()
  }, [competition])

  const formattedKickoff = useMemo(() => {
    return formatLocalizedKickoff(event?.date)
  }, [event?.date])

  const downAndDistance = useMemo(() => {
    return formatDownAndDistance(situation)
  }, [situation])

  // Sanitized Logo URLs
  const awayLogoUrl = useMemo(() => {
    return sanitizeUrl(awayComp?.team?.logo, FALLBACK_LOGO)
  }, [awayComp?.team?.logo])

  const homeLogoUrl = useMemo(() => {
    return sanitizeUrl(homeComp?.team?.logo, FALLBACK_LOGO)
  }, [homeComp?.team?.logo])

  const handleCopySnapshot = async () => {
    const awayName = sanitizeClipboardField(sanitizePatriotsName(awayComp?.team?.displayName || awayAbbr))
    const homeName = sanitizeClipboardField(sanitizePatriotsName(homeComp?.team?.displayName || homeAbbr))
    const awayScoreStr = sanitizeClipboardField(String(awayComp?.score ?? '-'))
    const homeScoreStr = sanitizeClipboardField(String(homeComp?.score ?? '-'))
    const statusText = isHalftime
      ? 'At Halftime'
      : isLive
      ? `Q${safePeriod} ${safeClock}`
      : isFinal
      ? sanitizeClipboardField(safeStatusDetail)
      : `Upcoming (${sanitizeClipboardField(formattedKickoff)})`
    const playText = isLive && situation?.downDistanceText
      ? ` • ${sanitizeClipboardField(situation.downDistanceText)} at ${sanitizeClipboardField(situation.possessionText || '')}`
      : ''
    const rzText = isRedZone ? ' 🔥 RED ZONE' : ''
    const usTv = sanitizeClipboardField(broadcastDetails.usTv, 'Check Local Listings')
    const crew = sanitizeClipboardField(broadcastDetails.announcers.fullCrew, 'Network Broadcast Team')

    const shareText = `🏈 NFL Score: ${awayName} (${awayScoreStr}) @ ${homeName} (${homeScoreStr}) [${statusText}${playText}${rzText}]\n📺 US TV: ${usTv}\n🎙️ Announcers: ${crew}\nLive Command: https://martindavies-code.github.io/nfl-live-dashboard/`.replace(/\bNE\b/g, 'FNE')

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareText)
        setIsCopied(true)
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current)
        }
        copyTimerRef.current = setTimeout(() => {
          setIsCopied(false)
          copyTimerRef.current = null
        }, 2500)
      }
    } catch {
      // Graceful fallback for clipboard permission rejections or headless environments
    }
  }

  const safeEventId = String(event?.id || reactId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const headingId = `hero-matchup-heading-${safeEventId}`

  const awayDisplayName = awayComp?.team?.displayName || awayAbbr
  const homeDisplayName = homeComp?.team?.displayName || homeAbbr

  // Guard clause: placed after all unconditional hooks have executed
  if (!competition) return null

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isRedZone
          ? 'card-tier-hero-redzone'
          : isFinal
          ? 'card-tier-hero-final'
          : !isLive
          ? 'card-tier-hero-upcoming'
          : 'card-tier-hero'
      }`}
      aria-labelledby={headingId}
    >
      {/* Accessible Heading for Screen Readers */}
      <h2 id={headingId} className="sr-only">
        {`Spotlight Matchup: ${awayDisplayName} at ${homeDisplayName}. ${
          isLive
            ? `Live in Quarter ${safePeriod} with ${safeClock} remaining`
            : isFinal
            ? safeStatusDetail
            : `Kickoff scheduled for ${formattedKickoff}`
        }`}
      </h2>

      {/* Top Accent Bar */}
      {isRedZone ? (
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse" />
      ) : isFinal ? (
        <div className="h-1.5 w-full bg-slate-700/60" />
      ) : !isLive ? (
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500/50 via-sky-500/40 to-transparent" />
      ) : (
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500" />
      )}

      {/* Editorial Spotlight Banner */}
      <div className={`flex items-center justify-between gap-2 border-b px-3.5 sm:px-5 py-2.5 sm:py-3 transition-colors ${
        isRedZone ? 'border-rose-500/20 bg-[#12080d]' : isFinal ? 'border-slate-800/60 bg-[#090e18]' : !isLive ? 'border-indigo-500/20 bg-[#0c1426]' : 'border-white/[0.08] bg-[#090e18]'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300 border border-sky-500/40 shrink-0">
            <Compass className="h-3.5 w-3.5" />
            SPOTLIGHT RADAR
          </span>

          {event.season?.type === 3 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2 sm:px-2.5 py-1 text-xs font-bold tracking-wide text-amber-300 border border-amber-500/50 shrink-0">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>{getWeekLabel(3, event.week?.number).toUpperCase()}</span>
            </span>
          )}

          {isRedZone ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-600/30 border border-rose-500/60 px-2 sm:px-2.5 py-1 text-xs font-bold tracking-wide text-rose-200 animate-pulse shrink-0">
              <Flame className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
              <span className="hidden xs:inline">
                {totalThreats && totalThreats > 1
                  ? `RED ZONE THREAT #${threatIndex} OF ${totalThreats}`
                  : isAutoSelectedRedZone
                  ? 'AUTO-TRACKED RED ZONE'
                  : 'RED ZONE THREAT'}
              </span>
              <span className="xs:hidden">RED ZONE</span>
            </span>
          ) : isHalftime ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2 sm:px-2.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/30 shrink-0">
              <Pause className="h-3.5 w-3.5 text-amber-400" />
              AT HALFTIME
            </span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-2 sm:px-2.5 py-1 text-xs font-bold text-rose-300 border border-rose-500/30 min-w-0">
              <Radio className="h-3.5 w-3.5 animate-pulse shrink-0" />
              <span className="hidden xs:inline">LIVE IN PROGRESS</span>
              <span className="xs:hidden">LIVE</span>
            </span>
          ) : isFinal ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/90 border border-slate-700/60 px-2.5 py-1 text-xs font-semibold text-slate-300 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              FINAL RECAP
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-950/80 px-2 sm:px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-800/50 min-w-0">
              <Calendar className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="hidden xs:inline">UPCOMING KICKOFF</span>
              <span className="xs:hidden">UPCOMING</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs text-slate-400 shrink-0">
          {/* Interactive Auto Red Zone Toggle (Only on single hero, multi-threat banner has global toggle) */}
          {!isMultiThreat && onToggleAutoRedZone && (
            <button
              onClick={onToggleAutoRedZone}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold border transition-all ${
                autoRedZone
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={
                autoRedZone
                  ? 'Auto Red Zone is ON: Automatically pins whichever matchup is driving inside the 20-yard line'
                  : 'Auto Red Zone is OFF: Click to automatically follow active scoring threats'
              }
            >
              <Flame className={`h-3.5 w-3.5 ${autoRedZone ? 'text-rose-400 fill-rose-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="hidden xs:inline">Auto Red Zone: <strong className="font-bold text-white">{autoRedZone ? 'ON' : 'OFF'}</strong></span>
              <span className="xs:hidden">Auto RZ: <strong className="font-bold text-white">{autoRedZone ? 'ON' : 'OFF'}</strong></span>
            </button>
          )}

          {/* 1-Click Share Snapshot Button */}
          <button
            onClick={handleCopySnapshot}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold border transition-all ${
              isCopied
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-sky-500/15 border-sky-500/40 text-sky-200 hover:bg-sky-500/25 hover:text-white'
            }`}
            title="Copy live score snapshot to clipboard for sharing"
            aria-label={isCopied ? "Live score snapshot copied to clipboard" : "Share live score snapshot"}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Share2 className="h-3.5 w-3.5 text-sky-400" />
            )}
            <span className="hidden xs:inline">{isCopied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Hero Content: Mobile First Hierarchy (Teams -> Field Radar -> Situation) & Desktop Balanced Grid */}
      <div className={
        isMultiThreat
          ? "flex flex-col gap-4 p-3.5 sm:p-4"
          : "grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-3.5 sm:p-6"
      }>
        {/* Block 1: Teams & Scores (Top-Left on Desktop, 6 columns) */}
        <div className={isMultiThreat ? "flex flex-col space-y-3" : "order-1 lg:order-1 col-span-12 lg:col-span-6 flex flex-col space-y-4 sm:space-y-6"}>
          {/* Quarter & Game Clock Banner */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-1.5 gap-x-2 border-b border-white/[0.06] pb-2.5 sm:pb-3">
            <div className="flex items-center gap-2 shrink-0">
              {isHalftime ? (
                <span className="font-mono text-xs font-extrabold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded border border-amber-500/40 uppercase tracking-wider flex items-center gap-1.5">
                  <Pause className="h-3.5 w-3.5 text-amber-400" />
                  AT HALFTIME
                </span>
              ) : isLive ? (
                <>
                  <span className="font-mono text-xs font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded whitespace-nowrap">
                    <span className="sm:hidden">Q{safePeriod}</span>
                    <span className="hidden sm:inline">Quarter {safePeriod}</span>
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-400 tabular-nums">
                    {safeClock}
                  </span>
                </>
              ) : isFinal ? (
                <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">
                  {safeStatusDetail}
                </span>
              ) : (
                <span className="font-mono text-xs font-bold text-sky-300 bg-sky-950/80 px-2.5 py-1 rounded border border-sky-800/40 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-400" />
                  Kickoff: {formattedKickoff}
                </span>
              )}
            </div>

            {venueText && (
              <span className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-400 min-w-0 max-w-full sm:max-w-[280px] truncate" title={venueText}>
                <MapPin className="h-3 w-3 text-slate-500 flex-shrink-0" />
                <span className="truncate">{venueText}</span>
              </span>
            )}
          </div>

          {/* Teams Scoreboard Display */}
          <div className="space-y-4">
            {/* Away Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
                  <img
                    src={awayLogoUrl}
                    alt={awayComp?.team?.displayName || 'Away Team'}
                    className={`h-full w-full object-contain ${
                      isDarkLogoTeam(awayComp?.team?.abbreviation, awayComp?.team?.displayName)
                        ? 'team-logo-dark-outline'
                        : 'filter drop-shadow-md'
                    } ${
                      isFinal && !isAwayWinner ? 'opacity-65' : ''
                    }`}
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = FALLBACK_LOGO
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
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <span className={`text-base sm:text-xl font-black tracking-tight leading-tight ${
                      isFinal
                        ? isAwayWinner
                          ? 'text-white'
                          : 'text-slate-400 font-medium'
                        : 'text-white'
                    }`}>
                      {awayComp?.team?.displayName || awayComp?.team?.name}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold shrink-0">
                      {sanitizePatriotsAbbreviation(awayComp?.team?.abbreviation)}
                    </span>
                    {isAwayWinner && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40 shadow-sm shrink-0">
                        <Check className="h-3 w-3 text-emerald-400" />
                        WIN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{awayComp?.records?.[0]?.summary || '0-0'}</span>
                    {isLive && (
                      <div className="flex items-center gap-1 ml-1" title={`${awayTimeouts} timeouts remaining`}>
                        {[1, 2, 3].map((num) => (
                          <span
                            key={`hero-away-to-${num}`}
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

              <span className={`font-['Oswald'] text-3xl sm:text-5xl font-bold tracking-tight tabular-nums shrink-0 ml-3 ${
                isFinal
                  ? isAwayWinner
                    ? 'text-white font-black'
                    : 'text-slate-500 font-bold'
                  : 'text-white'
              }`}>
                {awayScoreDisplay}
              </span>
            </div>

            {/* Home Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
                  <img
                    src={homeLogoUrl}
                    alt={homeComp?.team?.displayName || 'Home Team'}
                    className={`h-full w-full object-contain ${
                      isDarkLogoTeam(homeComp?.team?.abbreviation, homeComp?.team?.displayName)
                        ? 'team-logo-dark-outline'
                        : 'filter drop-shadow-md'
                    } ${
                      isFinal && !isHomeWinner ? 'opacity-65' : ''
                    }`}
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = FALLBACK_LOGO
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
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <span className={`text-base sm:text-xl font-black tracking-tight leading-tight ${
                      isFinal
                        ? isHomeWinner
                          ? 'text-white'
                          : 'text-slate-400 font-medium'
                        : 'text-white'
                    }`}>
                      {homeComp?.team?.displayName || homeComp?.team?.name}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold shrink-0">
                      {sanitizePatriotsAbbreviation(homeComp?.team?.abbreviation)}
                    </span>
                    {isHomeWinner && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40 shadow-sm shrink-0">
                        <Check className="h-3 w-3 text-emerald-400" />
                        WIN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{homeComp?.records?.[0]?.summary || '0-0'}</span>
                    {isLive && (
                      <div className="flex items-center gap-1 ml-1" title={`${homeTimeouts} timeouts remaining`}>
                        {[1, 2, 3].map((num) => (
                          <span
                            key={`hero-home-to-${num}`}
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

              <span className={`font-['Oswald'] text-3xl sm:text-5xl font-bold tracking-tight tabular-nums shrink-0 ml-3 ${
                isFinal
                  ? isHomeWinner
                    ? 'text-white font-black'
                    : 'text-slate-500 font-bold'
                  : 'text-white'
              }`}>
                {homeScoreDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Block 2: Full Dynamic 100-Yard Field Radar (Immediately below scores on mobile, Full-Width 12-Columns across Bottom on Desktop) */}
        <div className={isMultiThreat ? "flex flex-col justify-center" : "order-2 lg:order-3 col-span-12 flex flex-col justify-center"}>
          <FieldDiagram
            situation={situation}
            competitors={competitors}
            gameState={state}
            gameStatusDetail={
              isHalftime
                ? 'At Halftime'
                : isLive
                ? `Quarter ${safePeriod} ${safeClock}`
                : isFinal
                ? safeStatusDetail
                : `Kickoff: ${formattedKickoff}`
            }
            isHero={true}
            compact={Boolean(totalThreats && totalThreats > 1)}
            status={status}
            drivePlays={drivePlays}
          />
        </div>

        {/* Block 3: Matchup Intelligence Panel (Key Situation, Win Probability & Scorigami) */}
        <div className={isMultiThreat ? "flex flex-col space-y-3" : "order-3 lg:order-2 col-span-12 lg:col-span-6 flex flex-col justify-between"}>
          <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/90 p-3 sm:p-4 space-y-3 sm:space-y-3.5 shadow-sm">
            {/* Active Play Situation (Only shown during live games) */}
            {isLive && (
              <div className="border-b border-white/[0.06] pb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-400">
                    {isHalftime ? 'Game State' : 'Active Play Situation'}
                  </span>
                  <span className={`font-mono font-bold text-sm ${isHalftime ? 'text-amber-400' : 'text-amber-300'}`}>
                    {isHalftime ? 'Halftime Intermission' : downAndDistance}
                  </span>
                </div>
                {shouldDisplayLastPlayText(situation?.lastPlay?.text, isLive, hasFieldDrivePlays) && (
                  <p className="mt-2 text-xs text-slate-300 italic border-t border-white/[0.04] pt-1.5">
                    <span className="font-semibold text-slate-400 not-italic mr-1">Last Play:</span>
                    {situation?.lastPlay?.text}
                  </p>
                )}
              </div>
            )}

            {/* Win Probability Bar Component (bare mode: seamlessly integrated without redundant nested borders) */}
            <WinProbabilityBar
              homeWinPercentage={situation?.lastPlay?.probability?.homeWinPercentage}
              awayWinPercentage={situation?.lastPlay?.probability?.awayWinPercentage}
              homeCompetitor={homeComp}
              awayCompetitor={awayComp}
              gameState={state}
              status={status}
              situation={situation}
              odds={competition.odds}
              bare={true}
            />

            {/* Spotlight Scorigami Historical Milestone Section */}
            <div className="border-t border-white/[0.06] pt-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className={`h-3.5 w-3.5 ${scorigamiInfo.isCurrentScorigami ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-300">
                    {scorigamiInfo.isCurrentScorigami ? '✨ Live Scorigami in Progress' : 'Historical Scorigami Chance'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold text-xs tabular-nums px-2 py-0.5 rounded-md ${
                      scorigamiInfo.isCurrentScorigami
                        ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                        : 'bg-white/[0.06] text-slate-200 border border-white/[0.08]'
                    }`}
                  >
                    {scorigamiInfo.chanceLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScorigamiDetails((prev) => !prev)}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-2 focus:outline-none cursor-pointer"
                    aria-expanded={showScorigamiDetails}
                    aria-label={showScorigamiDetails ? "Collapse Scorigami details" : "Expand Scorigami details"}
                  >
                    {showScorigamiDetails ? 'Less' : 'Details'}
                  </button>
                </div>
              </div>

              {showScorigamiDetails && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.06] space-y-1.5 text-xs text-slate-400">
                  {scorigamiInfo.mostLikelyNovel && (
                    <div className="flex items-center justify-between">
                      <span>Most Likely Scorigami:</span>
                      <strong className="font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-700/40">
                        {scorigamiInfo.mostLikelyLabel}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-300">When: </span>
                    {scorigamiInfo.whenScenario}
                  </div>
                  {scorigamiInfo.lastGameSummary && (
                    <div className="border-t border-white/[0.06] pt-1.5 text-slate-400">
                      <span className="font-semibold text-slate-300">Last Occurred: </span>
                      <strong className="text-amber-300 font-medium">{scorigamiInfo.lastGameSummary}</strong>
                      <span className="text-slate-500 ml-1 font-mono text-[11px]">({scorigamiInfo.currentOccurrences}x in NFL history)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* US Announcing Crew & Network */}
      <div className="border-t border-white/[0.08] bg-[#080d17]/95 px-3.5 py-2.5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-md bg-rose-500/20 text-rose-300 shrink-0">
              <Mic className="h-4 w-4 text-rose-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">US Announcing Crew</span>
                <span className="text-[11px] font-mono font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/40">
                  {broadcastDetails.usTv}
                </span>
                {broadcastDetails.announcers.verified ? (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 shrink-0"
                    title={`Fact-checked ${broadcastDetails.announcers.verifiedOn ?? ''} — ${broadcastDetails.announcers.sources.map((s) => s.label).join('; ')}`}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 shrink-0"
                    title="Announce team not yet confirmed by the network — names are never guessed"
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    <span>Awaiting confirmation</span>
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-white mt-0.5 truncate">
                {broadcastDetails.announcers.leadDuo}
              </div>
            </div>
          </div>

          {broadcastDetails.announcers.sideline && (
            <div className="flex items-center gap-1.5 shrink-0 pl-9 sm:pl-0 text-slate-300 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
                Sideline
              </span>
              <span className="font-medium text-slate-200">{broadcastDetails.announcers.sideline}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
})
HeroMatchup.displayName = 'HeroMatchup'
