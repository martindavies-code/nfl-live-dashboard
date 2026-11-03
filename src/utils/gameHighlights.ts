import type { NFLEvent } from '../types/nfl'
import {
  getRegisteredHighlight,
  normalizeHighlightAbbr,
  type RegisteredHighlight,
} from '../data/highlightsRegistry.ts'
import { sanitizePatriotsName, sanitizePatriotsAbbreviation } from './nflHelpers.ts'

export interface GameHighlightInfo {
  url: string
  isDirect: boolean
  title: string
  label: string
  videoId?: string
  thumbnailUrl?: string
  channelUrl: string
}

const OFFICIAL_NFL_YOUTUBE_CHANNEL = 'https://www.youtube.com/@nfl'

/**
 * Resolves official NFL YouTube highlight links for an event.
 * If an exact verified video ID exists in the registry, provides the direct
 * watch URL (e.g. https://www.youtube.com/watch?v=j8XRNpYOsos).
 *
 * If not yet explicitly indexed, automatically produces a targeted search URL
 * scoped to the official NFL channel (@nfl) for that specific matchup.
 */
export function getGameHighlightInfo(event?: NFLEvent | null): GameHighlightInfo {
  const comp = event?.competitions?.[0]
  const awayComp = comp?.competitors?.find((c) => c.homeAway === 'away')
  const homeComp = comp?.competitors?.find((c) => c.homeAway === 'home')

  const rawAwayAbbr = awayComp?.team?.abbreviation || 'AWAY'
  const rawHomeAbbr = homeComp?.team?.abbreviation || 'HOME'
  const awayAbbr = sanitizePatriotsAbbreviation(rawAwayAbbr) || 'AWAY'
  const homeAbbr = sanitizePatriotsAbbreviation(rawHomeAbbr) || 'HOME'

  const rawAwayName = awayComp?.team?.displayName || awayComp?.team?.name || awayAbbr
  const rawHomeName = homeComp?.team?.displayName || homeComp?.team?.name || homeAbbr
  const awayName = sanitizePatriotsName(rawAwayName)
  const homeName = sanitizePatriotsName(rawHomeName)

  const seasonYear = event?.season?.year ?? 2026
  const seasonType = event?.season?.type ?? 2
  const weekNumber = event?.week?.number ?? 1

  // 1. Check authoritative registry for exact verified video ID
  const registered: RegisteredHighlight | null = getRegisteredHighlight(
    seasonYear,
    seasonType,
    weekNumber,
    rawAwayAbbr,
    rawHomeAbbr
  ) || getRegisteredHighlight(
    seasonYear,
    seasonType,
    weekNumber,
    normalizeHighlightAbbr(awayAbbr),
    normalizeHighlightAbbr(homeAbbr)
  )

  if (registered && registered.videoId) {
    return {
      url: `https://www.youtube.com/watch?v=${registered.videoId}`,
      isDirect: true,
      title: registered.title,
      label: 'Watch Highlights',
      videoId: registered.videoId,
      thumbnailUrl: `https://i.ytimg.com/vi/${registered.videoId}/hqdefault.jpg`,
      channelUrl: OFFICIAL_NFL_YOUTUBE_CHANNEL,
    }
  }

  // 2. Authoritative fallback: Targeted search on the official NFL YouTube channel (@nfl)
  const seasonTypeLabel = seasonType === 3 ? 'Playoffs' : 'Season'
  const searchQuery = `${awayName} vs ${homeName} Game Highlights ${seasonYear} NFL ${seasonTypeLabel} Week ${weekNumber}`
  const searchUrl = `${OFFICIAL_NFL_YOUTUBE_CHANNEL}/search?query=${encodeURIComponent(searchQuery)}`

  return {
    url: searchUrl,
    isDirect: false,
    title: `${awayName} vs ${homeName} Highlights | Official NFL Channel`,
    label: 'Watch Highlights',
    channelUrl: OFFICIAL_NFL_YOUTUBE_CHANNEL,
  }
}
