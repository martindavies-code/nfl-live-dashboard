import React, { useState } from 'react'
import type { NFLEvent } from '../types/nfl'
import { FieldDiagram } from './FieldDiagram'
import { WinProbabilityBar } from './WinProbabilityBar'
import { formatDownAndDistance, getOffensiveDrive, safeParseInt, isRedZoneSituation, isHalftimeSituation, getWeekLabel, formatLocalizedKickoff, sanitizePatriotsAbbreviation, sanitizePatriotsName } from '../utils/nflHelpers'
import { Radio, Flame, Tv, MapPin, Compass, Sparkles, Pause, Trophy, Share2, Check, Clock, Mic } from 'lucide-react'
import { getScorigamiInfo, getGameSecondsRemaining } from '../utils/scorigami'
import { getGameBroadcastDetails } from '../utils/broadcastInfo'

interface HeroMatchupProps {
  event: NFLEvent
  autoRedZone?: boolean
  onToggleAutoRedZone?: () => void
  isAutoSelectedRedZone?: boolean
  threatIndex?: number
  totalThreats?: number
}

const DEFAULT_NFL_LOGO = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png'

export const HeroMatchup: React.FC<HeroMatchupProps> = ({
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
  const competition = event.competitions?.[0]
  if (!competition) return null

  const competitors = competition.competitors || []
  const homeComp = competitors.find((c) => c.homeAway === 'home') || competitors[0]
  const awayComp = competitors.find((c) => c.homeAway === 'away') || competitors[1]

  const status = event.status || competition.status
  const state = status?.type?.state || 'pre'
  const isLive = state === 'in'
  const isFinal = state === 'post'

  const situation = competition.situation

  // Check possession with helper (only active during live games)
  const { isHomePossession, isAwayPossession } = getOffensiveDrive(
    isLive ? situation : null,
    competitors
  )

  const isRedZone = isRedZoneSituation(situation, status, competitors)
  const isHalftime = isHalftimeSituation(status, situation)

  const venueText = competition.venue
    ? `${competition.venue.fullName}${
        competition.venue.address?.city ? `, ${competition.venue.address.city}` : ''
      }`
    : ''

  const homeTimeouts = typeof situation?.homeTimeouts === 'number' && Number.isFinite(situation.homeTimeouts) ? situation.homeTimeouts : 3
  const awayTimeouts = typeof situation?.awayTimeouts === 'number' && Number.isFinite(situation.awayTimeouts) ? situation.awayTimeouts : 3

  const downAndDistance = formatDownAndDistance(situation)
  const formattedKickoff = formatLocalizedKickoff(event.date)
  const broadcastDetails = getGameBroadcastDetails(event)

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

  const handleCopySnapshot = async () => {
    const awayName = sanitizePatriotsName(awayComp?.team?.displayName || awayAbbr)
    const homeName = sanitizePatriotsName(homeComp?.team?.displayName || homeAbbr)
    const awayScore = awayComp?.score ?? '-'
    const homeScore = homeComp?.score ?? '-'
    const statusText = isHalftime
      ? 'At Halftime'
      : isLive
      ? `Q${status?.period} ${status?.displayClock}`
      : isFinal
      ? (status?.type?.detail || 'Final')
      : `Upcoming (${formattedKickoff})`
    const playText = isLive && situation?.downDistanceText ? ` • ${situation.downDistanceText} at ${situation.possessionText || ''}` : ''
    const rzText = isRedZone ? ' 🔥 RED ZONE' : ''

    const shareText = `🏈 NFL Score: ${awayName} (${awayScore}) @ ${homeName} (${homeScore}) [${statusText}${playText}${rzText}]\n📺 UK TV: ${broadcastDetails.ukTv} (${broadcastDetails.ukTvChannelNumber})\n📻 UK Radio: ${broadcastDetails.ukRadio}\n🎙️ Announcers: ${broadcastDetails.announcers.fullCrew}\nLive Command: https://martindavies-code.github.io/nfl-live-dashboard/`.replace(/\bNE\b/g, 'FNE')

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2500)
      }
    } catch {
      // Clipboard fallback
    }
  }

  const headingId = `hero-matchup-heading-${event.id}`

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isRedZone
          ? 'card-tier-hero-redzone'
          : 'card-tier-hero'
      }`}
      aria-labelledby={headingId}
    >
      {/* Accessible Heading for Screen Readers */}
      <h2 id={headingId} className="sr-only">
        {`Spotlight Matchup: ${awayComp?.team?.displayName || awayAbbr} at ${homeComp?.team?.displayName || homeAbbr}. ${
          isLive
            ? `Live in Quarter ${status.period} with ${status.displayClock} remaining`
            : isFinal
            ? (status?.type?.detail || 'Final')
            : `Kickoff scheduled for ${formattedKickoff}`
        }`}
      </h2>

      {/* Top Celluloid Accent Bar */}
      {isRedZone ? (
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-[#d4af37] animate-pulse" />
      ) : (
        <div className="h-1.5 w-full bg-gradient-to-r from-[#967417] via-[#d4af37] to-[#f6e082]" />
      )}

      {/* Editorial Spotlight Banner */}
      <div className={`flex items-center justify-between gap-2 border-b px-3.5 sm:px-5 py-2.5 sm:py-3 transition-colors ${
        isRedZone ? 'border-rose-500/30 bg-[#140a0e]' : 'border-[#d4af37]/20 bg-[#0a0b12]'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[#d4af37]/15 px-2.5 py-1 text-xs font-bold text-[#f6e082] border border-[#d4af37]/35 shrink-0 font-['Cinzel',serif] tracking-wider">
            <Compass className="h-3.5 w-3.5 text-[#d4af37]" />
            MARQUEE SPOTLIGHT
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
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-2 sm:px-2.5 py-1 text-xs font-bold text-rose-300 border border-rose-500/30 shrink-0">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>LIVE IN PROGRESS</span>
            </span>
          ) : isFinal ? (
            <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 shrink-0">
              FINAL RECAP
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-950 px-2 sm:px-2.5 py-1 text-xs font-semibold text-sky-300 border border-sky-800/40 shrink-0 truncate">
              <Clock className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span className="truncate">KICKOFF: {formattedKickoff.toUpperCase()}</span>
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
          ? "flex flex-col gap-4 p-4"
          : "grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 p-4 sm:p-6"
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
                    <span className="sm:hidden">Q{status.period}</span>
                    <span className="hidden sm:inline">Quarter {status.period}</span>
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-400 tabular-nums">
                    {status.displayClock}
                  </span>
                </>
              ) : isFinal ? (
                <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">
                  {status.type?.detail || 'Final'}
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
                    src={awayComp?.team?.logo || DEFAULT_NFL_LOGO}
                    alt={awayComp?.team?.displayName || 'Away Team'}
                    className="h-full w-full object-contain filter drop-shadow-md"
                    loading="eager"
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
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                      {awayComp?.team?.displayName || awayComp?.team?.name}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold shrink-0">
                      {sanitizePatriotsAbbreviation(awayComp?.team?.abbreviation)}
                    </span>
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

              <span className="font-['Oswald'] text-3xl sm:text-5xl font-bold tracking-tight text-white tabular-nums shrink-0 ml-3">
                {awayComp?.score ?? '-'}
              </span>
            </div>

            {/* Home Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
                  <img
                    src={homeComp?.team?.logo || DEFAULT_NFL_LOGO}
                    alt={homeComp?.team?.displayName || 'Home Team'}
                    className="h-full w-full object-contain filter drop-shadow-md"
                    loading="eager"
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
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                      {homeComp?.team?.displayName || homeComp?.team?.name}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold shrink-0">
                      {sanitizePatriotsAbbreviation(homeComp?.team?.abbreviation)}
                    </span>
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

              <span className="font-['Oswald'] text-3xl sm:text-5xl font-bold tracking-tight text-white tabular-nums shrink-0 ml-3">
                {homeComp?.score ?? '-'}
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
                ? `Quarter ${status?.period} ${status?.displayClock}`
                : isFinal
                ? (status?.type?.detail || 'Final')
                : `Kickoff: ${formattedKickoff}`
            }
            isHero={true}
            compact={Boolean(totalThreats && totalThreats > 1)}
            status={status}
          />
        </div>

        {/* Block 3: Key Situation, Win Probability Bar & Scorigami (Top-Right on Desktop, 6 columns) */}
        <div className={isMultiThreat ? "flex flex-col space-y-3.5" : "order-3 lg:order-2 col-span-12 lg:col-span-6 flex flex-col space-y-4"}>
          {/* Key Situation Box */}
          {isLive && (
            <div className="rounded-xl border border-white/[0.08] bg-[#090e18] p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400">
                  {isHalftime ? 'Game State' : 'Active Play Situation'}
                </span>
                <span className={`font-mono font-bold text-sm ${isHalftime ? 'text-amber-400' : 'text-amber-300'}`}>
                  {isHalftime ? 'Halftime Intermission' : downAndDistance}
                </span>
              </div>
              {situation?.lastPlay?.text && (
                <p className="mt-2 text-xs text-slate-300 italic border-t border-white/[0.06] pt-2">
                  <span className="font-semibold text-slate-400 not-italic mr-1">Last Play:</span>
                  {situation.lastPlay.text}
                </p>
              )}
            </div>
          )}

          {/* Win Probability Bar Component */}
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

          {/* Spotlight Scorigami Historical Milestone Section */}
          <div
            className={`rounded-xl border p-3 text-xs transition-colors ${
              scorigamiInfo.isCurrentScorigami
                ? 'border-indigo-500/50 bg-gradient-to-r from-indigo-950/60 to-slate-900/80 text-indigo-200 shadow-md shadow-indigo-950/40'
                : 'border-white/[0.08] bg-[#090e18] text-slate-300'
            }`}
          >
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
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-2 focus:outline-none"
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

      {/* UK Broadcast, Radio & Live Announcers Center */}
      {isMultiThreat ? (
        <div className="border-t border-white/[0.08] bg-[#080d17]/95 px-3.5 py-2.5">
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between gap-2 text-slate-300">
              <span className="flex items-center gap-1.5 truncate">
                <Tv className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <strong className="text-white truncate">{broadcastDetails.ukTv}</strong>
                <span className="text-slate-400 text-[11px] font-mono shrink-0">({broadcastDetails.ukTvChannelNumber})</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0 text-slate-400">
                <Radio className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-300 truncate max-w-[130px]">{broadcastDetails.ukRadio}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-slate-400 border-t border-white/[0.04] pt-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate">
                  <Mic className="h-3 w-3 text-rose-400 shrink-0" />
                  <span className={broadcastDetails.announcers.verified ? 'text-slate-200 font-medium truncate' : 'text-amber-300/90 italic truncate'}>
                    {broadcastDetails.announcers.leadDuo}
                  </span>
                  {broadcastDetails.announcers.verified ? (
                    <span
                      className="inline-flex shrink-0 text-emerald-400"
                      title={`Fact-checked ${broadcastDetails.announcers.verifiedOn ?? ''}`}
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                  ) : (
                    <span
                      className="inline-flex shrink-0 text-amber-400"
                      title="Announce team not yet confirmed"
                    >
                      <Clock className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="text-slate-500 font-mono text-[10px] shrink-0">({broadcastDetails.usTv})</span>
              </div>
              {broadcastDetails.announcers.sideline && (
                <div className="text-[10px] text-slate-400 pl-4.5 flex items-center gap-1">
                  <span className="text-slate-400 uppercase text-[8px] font-semibold tracking-wider px-1 py-0.2 rounded bg-white/[0.05]">Sideline</span>
                  <span className="text-slate-300">{broadcastDetails.announcers.sideline}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#d4af37]/20 bg-[#07080d]/98 px-3.5 py-3 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* UK TV Channel */}
            <div className="flex items-start gap-2.5 rounded-lg bg-gradient-to-br from-[#0c1424] to-[#080a12] border border-sky-500/30 px-3 py-2 text-sky-200 shadow-md">
              <div className="p-1.5 rounded-md bg-sky-500/20 text-sky-300 flex-shrink-0 mt-0.5">
                <Tv className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 block font-['Cinzel',serif]">UK Television</span>
                <span className="font-bold text-white text-xs sm:text-sm block">{broadcastDetails.ukTv}</span>
                <span className="text-[11px] text-sky-300/80 font-mono block mt-0.5">({broadcastDetails.ukTvChannelNumber})</span>
              </div>
            </div>

            {/* UK Radio Broadcast */}
            <div className="flex items-start gap-2.5 rounded-lg bg-gradient-to-br from-[#1a140a] to-[#0a0b10] border border-[#d4af37]/35 px-3 py-2 text-amber-200 shadow-md">
              <div className="p-1.5 rounded-md bg-[#d4af37]/20 text-[#f6e082] flex-shrink-0 mt-0.5">
                <Radio className="h-4 w-4 text-[#d4af37]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#d4af37] block font-['Cinzel',serif]">UK Radio Broadcast</span>
                <span className="font-bold text-white text-xs sm:text-sm block">{broadcastDetails.ukRadio}</span>
                <span className="text-[11px] text-amber-200/80 font-mono block mt-0.5">({broadcastDetails.ukRadioFrequency})</span>
              </div>
            </div>

            {/* Announcers Calling the Game — Vintage Press Box Plaque */}
            <div className="flex items-start gap-2.5 rounded-lg bg-gradient-to-br from-[#1c1216] to-[#0c0d12] border border-rose-500/30 px-3 py-2 shadow-md">
              <div className="p-1.5 rounded-md bg-rose-500/20 text-rose-300 flex-shrink-0 mt-0.5">
                <Mic className="h-4 w-4 text-rose-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 font-['Cinzel',serif]">Live Commentary Booth</span>
                  <span className="text-[10px] text-amber-200/70 font-mono">({broadcastDetails.usTv})</span>
                </div>
                <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-xs sm:text-sm mt-0.5">
                  <strong className={broadcastDetails.announcers.verified ? 'text-white font-bold' : 'text-amber-300 font-bold italic'}>
                    {broadcastDetails.announcers.leadDuo}
                  </strong>
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
                {broadcastDetails.announcers.sideline && (
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[#d4af37] font-semibold uppercase text-[9px] tracking-wider px-1.5 py-0.5 rounded bg-[#d4af37]/10 border border-[#d4af37]/25">Sideline</span>
                    <span className="text-slate-200 font-medium">{broadcastDetails.announcers.sideline}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* UK Studio Pundits & Streaming Options */}
          <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-300">UK Studio:</span>
              <span>{broadcastDetails.ukPundits}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="font-semibold text-slate-300">Streaming:</span>
              <span className="text-slate-400">{broadcastDetails.streaming}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
