import type { NFLSituation } from '../types/nfl'
import { safeParseInt, sanitizeHexColor, getContrastYIQ, formatLocalizedKickoff, sanitizePatriotsName, sanitizePatriotsAbbreviation } from './nflHelpers.ts'

export const FALLBACK_LOGO = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png'

export interface NormalizedTeam {
  id: string
  name: string
  displayName: string
  abbreviation: string
  color: string
  textColor: 'white' | 'black'
  logo: string
}

export interface NormalizedCompetitor {
  id: string
  homeAway: 'home' | 'away'
  score: number
  displayScore: string
  record: string
  timeouts: number
  hasBall: boolean
  team: NormalizedTeam
}

export interface NormalizedSituation {
  down: number
  distance: number
  yardLine: number
  scrimmageX: number
  firstDownX: number
  direction: 'right' | 'left'
  isRedZone: boolean
  isGoalToGo: boolean
  formattedText: string
  possessionTeamAbbr: string
  lastPlayText: string
  homeWinPct: number
  awayWinPct: number
}

export interface NormalizedEvent {
  id: string
  name: string
  shortName: string
  date: string
  formattedKickoff: string
  state: 'pre' | 'in' | 'post'
  period: number
  displayClock: string
  detail: string
  home: NormalizedCompetitor
  away: NormalizedCompetitor
  situation: NormalizedSituation | null
  broadcast: string
  venue: string
}

/**
 * Sanitize URLs to prevent XSS, prototype injection, SSRF, and malicious protocol schemes.
 * - Blocks control characters, non-printable ASCII (0-31, 127), and Unicode directional overrides
 * - Blocks dangerous pseudo-protocols (javascript:, vbscript:, file:, blob:)
 * - Blocks userinfo credential injection (http://user:pass@host)
 * - Validates HTTP and HTTPS schemes via RFC URL parser
 * - For data:image/ URIs:
 *   - Allows safe raster images (png, jpeg, webp, gif)
 *   - For SVG data URIs (utf8 or base64): strictly decodes and scans against XSS vectors:
 *     script tags, event handlers (on[a-z]+), foreignObject, use, animate, set, handler,
 *     javascript:/vbscript: links, XML entity declarations, CDATA blocks.
 */
/**
 * Strictly verifies whether an input is a safe HTTP or HTTPS URL without credentials.
 */
function isSafeHttpUrl(url?: unknown): url is string {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const p = new URL(trimmed)
    return (p.protocol === 'http:' || p.protocol === 'https:') && !p.username && !p.password
  } catch {
    return false
  }
}

/**
 * Decodes percent encoding, decimal entities, hex entities, and common named entities
 * to unmask obfuscated injection vectors.
 */
function decodeAllEntities(str: string): string {
  let decoded = str
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }

  // Decode hex entities: &#x61; or &#x61
  decoded = decoded.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16))
    } catch {
      return ''
    }
  })

  // Decode decimal entities: &#97; or &#97
  decoded = decoded.replace(/&#([0-9]+);?/g, (_, dec) => {
    try {
      return String.fromCharCode(parseInt(dec, 10))
    } catch {
      return ''
    }
  })

  // Decode named entities
  decoded = decoded
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, ' ')
    .replace(/&newline;/gi, ' ')
    .replace(/&quot;/gi, '"')

  return decoded
}

/**
 * Sanitize URLs to prevent XSS, prototype injection, SSRF, and malicious protocol schemes.
 * - Validates fallback parameter to ensure untrusted fallback strings cannot introduce vulnerabilities
 * - Blocks control characters, non-printable ASCII (0-31, 127), and Unicode directional overrides
 * - Blocks dangerous pseudo-protocols (javascript:, vbscript:, file:, blob:, data:text/html)
 * - Blocks userinfo credential injection (http://user:pass@host)
 * - Validates HTTP and HTTPS schemes via RFC URL parser
 * - For data:image/ URIs:
 *   - Allows safe raster images (png, jpeg, webp, gif)
 *   - For SVG data URIs (utf8 or base64): strictly decodes entities, scans against XSS vectors:
 *     script tags, style tags, foreignObject, use, animate, set, handler, iframe, embed, object,
 *     xlink:href/href javascript links, event handlers (on[a-z]+), XML entities, DOCTYPE declarations.
 */
export function sanitizeUrl(url?: string | null, fallback = FALLBACK_LOGO): string {
  const safeFallback = isSafeHttpUrl(fallback) ? fallback : FALLBACK_LOGO
  if (!url || typeof url !== 'string') return safeFallback
  const trimmed = url.trim()
  if (!trimmed) return safeFallback

  // Block control characters, null bytes, and unicode directional formatting controls
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (
      (code >= 0 && code <= 31) ||
      code === 127 ||
      (code >= 0x200e && code <= 0x200f) || // LTR / RTL marks
      (code >= 0x202a && code <= 0x202e)    // Embedding / override controls
    ) {
      return safeFallback
    }
  }

  // Strip internal whitespace for protocol detection (e.g. "java\tscript:" -> "javascript:")
  const compactUrl = trimmed.replace(/[\s\r\n\t]+/g, '').toLowerCase()

  // Explicitly disallow dangerous pseudo-protocols and forbidden schemes
  if (/^(?:javascript|vbscript|file|blob|data:text|data:application):/i.test(compactUrl)) {
    return safeFallback
  }

  // Parse HTTP/HTTPS URLs strictly
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      // Reject URLs with embedded credentials (prevents credential-leakage or phishing vectors)
      if (parsed.username || parsed.password) {
        return safeFallback
      }
      return parsed.href
    }
  } catch {
    // Fall through to data URI check
  }

  // Safe data:image URIs
  if (/^data:image\//i.test(trimmed)) {
    // 1. Safe raster formats (png, jpeg, jpg, webp, gif)
    if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return trimmed
    }

    // 2. SVG data URIs: require rigorous inspection
    if (/^data:image\/svg\+xml/i.test(trimmed)) {
      let rawContent = trimmed

      if (/;base64,/i.test(trimmed)) {
        const base64Part = trimmed.split(/;base64,/i)[1] || ''
        try {
          if (typeof atob === 'function') {
            rawContent = atob(base64Part)
          } else if (typeof globalThis !== 'undefined' && 'Buffer' in globalThis) {
            const nodeBuf = (globalThis as unknown as { Buffer: { from: (s: string, e: string) => { toString: (e: string) => string } } }).Buffer
            rawContent = nodeBuf.from(base64Part, 'base64').toString('utf-8')
          } else {
            return safeFallback
          }
        } catch {
          return safeFallback
        }
      }

      // Fully decode entities, percent-encoding, and hex representations
      const decodedContent = decodeAllEntities(rawContent)

      // Check decoded content for malicious SVG script execution and injection vectors
      const maliciousPatterns = [
        /<script/i,
        /<\/script/i,
        /<style/i,
        /<\/style/i,
        /@import/i,
        /\bon[a-z]+\s*=/i, // any event handler (onload, onerror, onclick, onbegin, etc.)
        /<foreignObject/i,
        /<use/i,
        /<animate/i,
        /<set/i,
        /<handler/i,
        /<iframe/i,
        /<embed/i,
        /<object/i,
        /<applet/i,
        /<link/i,
        /<meta/i,
        /<base/i,
        /<form/i,
        /<input/i,
        /<button/i,
        /<isindex/i,
        /<!ENTITY/i,
        /<!DOCTYPE/i,
        /SYSTEM\s+["']/i,
        /PUBLIC\s+["']/i,
        /\b(?:xlink:)?href\s*=\s*["']?\s*(?:javascript|vbscript|data):/i,
        /\b(?:src|action)\s*=\s*["']?\s*(?:javascript|vbscript|data):/i,
        /javascript\s*:/i,
        /vbscript\s*:/i,
        /data:\s*text\/html/i,
      ]

      for (const pattern of maliciousPatterns) {
        if (pattern.test(decodedContent)) {
          return safeFallback
        }
      }

      return trimmed
    }
  }

  return safeFallback
}

/**
 * Military-grade event normalization: guarantees 100% crash-proof, fully populated data
 * regardless of missing fields, malformed types, or partial ESPN network responses.
 */
export function normalizeNFLEvent(raw: any, index = 0): NormalizedEvent {
  const safeObj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const comp = safeObj.competitions && Array.isArray(safeObj.competitions) && safeObj.competitions[0] && typeof safeObj.competitions[0] === 'object'
    ? safeObj.competitions[0]
    : {}

  const id = String(safeObj.id || comp.id || `match-${index}-${Date.now()}`)
  const name = sanitizePatriotsName(String(safeObj.name || 'NFL Matchup'))
  const shortName = sanitizePatriotsName(String(safeObj.shortName || 'NFL'))
  const dateStr = String(safeObj.date || comp.date || new Date().toISOString())

  const formattedKickoff = formatLocalizedKickoff(dateStr)

  // Status normalization
  const statusObj = (safeObj.status && typeof safeObj.status === 'object') ? safeObj.status : comp.status || {}
  const typeObj = (statusObj.type && typeof statusObj.type === 'object') ? statusObj.type : {}
  const rawState = String(typeObj.state || '').toLowerCase()
  const state: 'pre' | 'in' | 'post' =
    rawState === 'in' ? 'in' : rawState === 'post' ? 'post' : 'pre'

  const period = Math.max(1, safeParseInt(statusObj.period, 1))
  const displayClock = String(statusObj.displayClock || '0:00')
  const detail = String(state === 'pre' ? formattedKickoff : (typeObj.detail || (state === 'post' ? 'Final' : `Q${period}`)))

  // Competitors normalization
  const rawCompetitors: any[] = Array.isArray(comp.competitors) ? comp.competitors : []
  let homeRaw = rawCompetitors.find((c) => c && c.homeAway === 'home')
  let awayRaw = rawCompetitors.find((c) => c && c.homeAway === 'away')

  if (!homeRaw && !awayRaw) {
    homeRaw = rawCompetitors[0] || {}
    awayRaw = rawCompetitors[1] || {}
  } else if (!homeRaw) {
    homeRaw = { homeAway: 'home' }
  } else if (!awayRaw) {
    awayRaw = { homeAway: 'away' }
  }

  const rawSituation: NFLSituation | null =
    (comp.situation && typeof comp.situation === 'object') ? comp.situation : null

  const possessionId = rawSituation?.possession ? String(rawSituation.possession) : null

  function normalizeTeam(rawC: any, defaultAbbr: string, defaultName: string): NormalizedCompetitor {
    const t = (rawC.team && typeof rawC.team === 'object') ? rawC.team : {}
    const teamId = String(t.id || rawC.id || defaultAbbr)
    const rawTeamName = String(t.displayName || t.name || defaultName)
    const rawAbbr = String(t.abbreviation || defaultAbbr).toUpperCase()
    const isPatriots = rawAbbr === 'NE' || rawAbbr === 'FNE' || teamId === '17' ||
      rawTeamName.includes('Patriots') || rawTeamName.includes('New England')
    const abbr = isPatriots ? 'FNE' : sanitizePatriotsAbbreviation(rawAbbr)
    const teamName = sanitizePatriotsName(rawTeamName)
    const color = sanitizeHexColor(t.color, defaultAbbr === 'HOME' ? '#00338d' : '#b91c1c')
    const textColor = getContrastYIQ(color)
    const logo = sanitizeUrl(t.logo)

    const scoreNum = safeParseInt(rawC.score, 0)
    const displayScore = state === 'pre' && (rawC.score === undefined || rawC.score === null || rawC.score === '-')
      ? '-'
      : String(scoreNum)

    const recordsArr = Array.isArray(rawC.records) ? rawC.records : []
    const record = recordsArr[0]?.summary ? String(recordsArr[0].summary) : '0-0'

    const timeouts = Math.max(0, Math.min(3, safeParseInt(
      rawC.homeAway === 'home' ? rawSituation?.homeTimeouts : rawSituation?.awayTimeouts,
      3
    )))

    const hasBall = state === 'in' && Boolean(
      possessionId && (teamId === possessionId || String(rawC.id) === possessionId)
    )

    return {
      id: teamId,
      homeAway: rawC.homeAway === 'home' ? 'home' : 'away',
      score: scoreNum,
      displayScore,
      record,
      timeouts,
      hasBall,
      team: {
        id: teamId,
        name: sanitizePatriotsName(String(t.name || defaultName)),
        displayName: teamName,
        abbreviation: abbr,
        color,
        textColor,
        logo,
      },
    }
  }

  const home = normalizeTeam(homeRaw, 'HOME', 'Home Team')
  const away = normalizeTeam(awayRaw, 'AWAY', 'Away Team')

  // Situation Normalization
  let situation: NormalizedSituation | null = null

  if (rawSituation && typeof rawSituation === 'object' && state === 'in') {
    const yardLineRaw = safeParseInt(rawSituation.yardLine, 50)
    const yardLine = Math.max(0, Math.min(100, yardLineRaw))
    const scrimmageX = 100 + yardLine * 10

    const down = safeParseInt(rawSituation.down, -1)
    const distance = Math.max(0, Math.min(99, safeParseInt(rawSituation.distance, 10)))

    // Determine direction
    let direction: 'right' | 'left' = 'right'
    let possessionAbbr = home.team.abbreviation

    if (home.hasBall) {
      direction = 'right'
      possessionAbbr = home.team.abbreviation
    } else if (away.hasBall) {
      direction = 'left'
      possessionAbbr = away.team.abbreviation
    } else if (rawSituation.possessionText) {
      const pText = String(rawSituation.possessionText).toUpperCase()
      if (pText.includes(home.team.abbreviation) || (home.team.abbreviation === 'FNE' && /\bNE\b/.test(pText))) {
        direction = 'right'
        possessionAbbr = home.team.abbreviation
      } else if (pText.includes(away.team.abbreviation) || (away.team.abbreviation === 'FNE' && /\bNE\b/.test(pText))) {
        direction = 'left'
        possessionAbbr = away.team.abbreviation
      }
    }

    // First down marker
    let firstDownYardLine = yardLine
    if (direction === 'right') {
      firstDownYardLine = Math.min(100, yardLine + distance)
    } else {
      firstDownYardLine = Math.max(0, yardLine - distance)
    }
    const firstDownX = 100 + firstDownYardLine * 10

    const isGoalToGo =
      down > 0 &&
      ((direction === 'right' && yardLine + distance >= 100) ||
        (direction === 'left' && yardLine - distance <= 0))

    const isRedZone = Boolean(
      rawSituation.isRedZone ||
        (direction === 'right' && yardLine >= 80) ||
        (direction === 'left' && yardLine <= 20)
    )

    // Formatted Down & Distance
    const rawPosText = rawSituation.possessionText ? String(rawSituation.possessionText).replace(/\bNE\b/g, 'FNE') : ''
    let formattedText = rawSituation.downDistanceText ? String(rawSituation.downDistanceText).replace(/\bNE\b/g, 'FNE') : ''
    if (!formattedText || formattedText.trim() === '') {
      if (down > 0) {
        const sfx = down === 1 ? '1st' : down === 2 ? '2nd' : down === 3 ? '3rd' : '4th'
        formattedText = `${sfx} & ${isGoalToGo ? 'Goal' : distance}`
        if (rawPosText) {
          formattedText += ` at ${rawPosText}`
        }
      } else {
        formattedText = 'Kickoff / PAT'
      }
    }

    const lastPlayText = rawSituation.lastPlay?.text ? String(rawSituation.lastPlay.text).trim() : ''

    // Win probability
    let homeWinPct = 50
    let awayWinPct = 50

    const rawProb = rawSituation.lastPlay?.probability
    if (rawProb && typeof rawProb.homeWinPercentage === 'number' && Number.isFinite(rawProb.homeWinPercentage)) {
      homeWinPct = rawProb.homeWinPercentage <= 1 ? rawProb.homeWinPercentage * 100 : rawProb.homeWinPercentage
      if (typeof rawProb.awayWinPercentage === 'number' && Number.isFinite(rawProb.awayWinPercentage)) {
        awayWinPct = rawProb.awayWinPercentage <= 1 ? rawProb.awayWinPercentage * 100 : rawProb.awayWinPercentage
      } else {
        awayWinPct = 100 - homeWinPct
      }
    } else {
      // Score-based live estimate
      const diff = home.score - away.score
      const est = 50 + Math.max(-42, Math.min(42, diff * 3.5))
      homeWinPct = est
      awayWinPct = 100 - est
    }

    homeWinPct = Math.max(2, Math.min(98, Math.round(homeWinPct * 10) / 10))
    awayWinPct = Math.max(2, Math.min(98, Math.round((100 - homeWinPct) * 10) / 10))

    situation = {
      down,
      distance,
      yardLine,
      scrimmageX,
      firstDownX,
      direction,
      isRedZone,
      isGoalToGo,
      formattedText,
      possessionTeamAbbr: possessionAbbr,
      lastPlayText,
      homeWinPct,
      awayWinPct,
    }
  }

  // Broadcast & Venue
  const broadcastsArr = Array.isArray(comp.broadcasts) ? comp.broadcasts : []
  const broadcastNames = broadcastsArr[0]?.names && Array.isArray(broadcastsArr[0].names)
    ? broadcastsArr[0].names.join(', ')
    : safeObj.broadcast || ''

  const venueFullName = comp.venue?.fullName ? String(comp.venue.fullName) : ''
  const venueCity = comp.venue?.address?.city ? String(comp.venue.address.city) : ''
  const venue = venueFullName ? `${venueFullName}${venueCity ? `, ${venueCity}` : ''}` : ''

  return {
    id,
    name,
    shortName,
    date: dateStr,
    formattedKickoff,
    state,
    period,
    displayClock,
    detail,
    home,
    away,
    situation,
    broadcast: broadcastNames,
    venue,
  }
}
