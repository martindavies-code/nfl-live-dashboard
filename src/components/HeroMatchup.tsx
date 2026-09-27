import React from 'react'
import type { NFLEvent } from '../types/nfl'
import { FieldDiagram } from './FieldDiagram'
import { WinProbabilityBar } from './WinProbabilityBar'
import { formatDownAndDistance, getOffensiveDrive } from '../utils/nflHelpers'
import { Radio, Flame, Tv, MapPin, Compass } from 'lucide-react'

interface HeroMatchupProps {
  event: NFLEvent
  autoRedZone?: boolean
  onToggleAutoRedZone?: () => void
  isAutoSelectedRedZone?: boolean
}

const DEFAULT_NFL_LOGO = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png'

export const HeroMatchup: React.FC<HeroMatchupProps> = ({
  event,
  autoRedZone = true,
  onToggleAutoRedZone,
  isAutoSelectedRedZone = false,
}) => {
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

  const broadcastNetwork =
    competition.broadcasts?.[0]?.names?.join(', ') ||
    (event as any).broadcast ||
    'National Broadcast'

  const venueText = competition.venue
    ? `${competition.venue.fullName}${
        competition.venue.address?.city ? `, ${competition.venue.address.city}` : ''
      }`
    : ''

  const homeTimeouts = typeof situation?.homeTimeouts === 'number' ? situation.homeTimeouts : 3
  const awayTimeouts = typeof situation?.awayTimeouts === 'number' ? situation.awayTimeouts : 3

  const downAndDistance = formatDownAndDistance(situation)

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#111927] to-[#0c1322] shadow-2xl"
      aria-labelledby="hero-matchup-heading"
    >
      {/* Editorial Spotlight Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#090e18] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
            <Compass className="h-3.5 w-3.5" />
            SPOTLIGHT MATCHUP
          </span>

          {isAutoSelectedRedZone && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/30 border border-rose-500/50 px-2.5 py-1 text-xs font-bold text-rose-200 animate-pulse shadow-sm shadow-rose-950">
              <Flame className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
              AUTO-SPOTLIGHT: RED ZONE
            </span>
          )}

          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-300 border border-rose-500/30">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              LIVE IN PROGRESS
            </span>
          ) : isFinal ? (
            <span className="rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
              FINAL RECAP
            </span>
          ) : (
            <span className="rounded bg-sky-950 px-2.5 py-1 text-xs font-semibold text-sky-300 border border-sky-800/40">
              UPCOMING KICKOFF
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          {/* Interactive Auto Red Zone Toggle */}
          {onToggleAutoRedZone && (
            <button
              onClick={onToggleAutoRedZone}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all ${
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
              <span>Auto Red Zone: <strong className="font-bold text-white">{autoRedZone ? 'ON' : 'OFF'}</strong></span>
            </button>
          )}

          {isLive && situation?.isRedZone && !isAutoSelectedRedZone && (
            <span className="inline-flex items-center gap-1 rounded bg-rose-600/30 border border-rose-500/40 px-2 py-0.5 text-xs font-bold text-rose-300 animate-pulse">
              <Flame className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
              RED ZONE DRIVE
            </span>
          )}

          {broadcastNetwork && (
            <span className="hidden sm:flex items-center gap-1 text-slate-400">
              <Tv className="h-3.5 w-3.5 text-slate-500" />
              {broadcastNetwork}
            </span>
          )}
        </div>
      </div>

      {/* Hero Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-6">
        {/* Left Column: Teams & Scores */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          {/* Quarter & Game Clock Banner */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded">
                {isLive ? `Quarter ${status.period}` : status.type?.detail || 'Match Details'}
              </span>
              {isLive && (
                <span className="font-mono text-sm font-extrabold text-emerald-400 tabular-nums">
                  {status.displayClock}
                </span>
              )}
            </div>

            {venueText && (
              <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[200px]" title={venueText}>
                <MapPin className="h-3 w-3 text-slate-500 flex-shrink-0" />
                {venueText}
              </span>
            )}
          </div>

          {/* Teams Scoreboard Display */}
          <div className="space-y-4">
            {/* Away Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative h-14 w-14 flex-shrink-0">
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
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] shadow"
                      title="Possession"
                    >
                      🏈
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span id="hero-matchup-heading" className="text-xl font-black text-white tracking-tight">
                      {awayComp?.team?.displayName || awayComp?.team?.name}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      {awayComp?.team?.abbreviation}
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

              <span className="font-['Oswald'] text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                {awayComp?.score ?? '-'}
              </span>
            </div>

            {/* Home Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative h-14 w-14 flex-shrink-0">
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
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] shadow"
                      title="Possession"
                    >
                      🏈
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-white tracking-tight">
                      {homeComp?.team?.displayName || homeComp?.team?.name}
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      {homeComp?.team?.abbreviation}
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

              <span className="font-['Oswald'] text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                {homeComp?.score ?? '-'}
              </span>
            </div>
          </div>

          {/* Key Situation Box */}
          {isLive && (
            <div className="rounded-xl border border-white/[0.08] bg-[#090e18] p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400">
                  Active Play Situation
                </span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {downAndDistance}
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
          />
        </div>

        {/* Right Column: Full Dynamic 100-Yard Field Radar */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <FieldDiagram
            situation={situation}
            competitors={competitors}
            gameState={state}
            gameStatusDetail={status?.type?.detail}
            isHero={true}
          />
        </div>
      </div>
    </section>
  )
}
