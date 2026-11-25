#!/usr/bin/env node
/**
 * Automated weekly announcer ingestion (pre-audit step).
 *
 *  1. Derives target weeks from ESPN's live calendar for the next 10 days (so holiday
 *     Wednesday/Thursday/Friday/Saturday games are never missed before a week flip).
 *  2. Discovers candidate announcer articles in order:
 *     (a) CLI --url overrides and manual entries in scripts/announcer-sources.json
 *     (b) Bing News RSS (Yahoo Sports, Awful Announcing, Akron Beacon Journal / USA Today)
 *     (c) Second search route: Awful Announcing search RSS2 / NFL feed, Yahoo Sports NFL RSS/page,
 *         and DuckDuckGo HTML fallback
 *  3. Parses Yahoo/506sports inline layouts, Awful Announcing "Team at Team (time, network): ..."
 *     layouts, and legacy "Announcers:" layouts.
 *  4. Enforces two-independent-source verification: a pairing is only written when confirmed by
 *     two independent source domains that agree (or one source with --confirm-single-source /
 *     "confirmed": true in scripts/announcer-sources.json). Disagreements write nothing and log
 *     the conflict.
 *  5. Logs every unmatched ESPN game with its exact reason (no pairing found, TBA crew,
 *     team name not parsed, ambiguous, kickoff outside the week window).
 *
 * Usage:
 *   node --experimental-strip-types scripts/update-announcers.mjs [--week N] [--weeks 2]
 *     [--url <article>] [--confirm-single-source] [--dry-run] [--strict] [--report-file <path>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { findVerifiedCrew, normalizeTeamAbbr } from '../src/data/announcerRegistry.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY_FILE = path.resolve(__dirname, '../src/data/announcerRegistry.ts')
const SOURCES_FILE = path.resolve(__dirname, './announcer-sources.json')
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const BROWSER_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Cache-Control': 'max-age=0',
}

// Nicknames -> ESPN abbreviations (keyed on unique team nicknames).
const TEAMS = {
  Cardinals: 'ARI', Falcons: 'ATL', Ravens: 'BAL', Bills: 'BUF', Panthers: 'CAR', Bears: 'CHI',
  Bengals: 'CIN', Browns: 'CLE', Cowboys: 'DAL', Broncos: 'DEN', Lions: 'DET', Packers: 'GB',
  Texans: 'HOU', Colts: 'IND', Jaguars: 'JAX', Chiefs: 'KC', Chargers: 'LAC', Rams: 'LAR',
  Raiders: 'LV', Dolphins: 'MIA', Vikings: 'MIN', Patriots: 'NE', Pats: 'NE', Saints: 'NO',
  Giants: 'NYG', Jets: 'NYJ', Eagles: 'PHI', Steelers: 'PIT', Seahawks: 'SEA',
  '49ers': 'SF', Niners: 'SF', Buccaneers: 'TB', Bucs: 'TB', Titans: 'TEN', Commanders: 'WSH',
}

// Unambiguous single-team cities/regions (used only as fallback when nicknames are absent).
// New York and Los Angeles are deliberately excluded because each has two NFL teams.
const UNAMBIGUOUS_CITIES = {
  Arizona: 'ARI', Atlanta: 'ATL', Baltimore: 'BAL', Buffalo: 'BUF', Carolina: 'CAR', Chicago: 'CHI',
  Cincinnati: 'CIN', Cleveland: 'CLE', Dallas: 'DAL', Denver: 'DEN', Detroit: 'DET', 'Green Bay': 'GB',
  Houston: 'HOU', Indianapolis: 'IND', Jacksonville: 'JAX', 'Kansas City': 'KC', 'Las Vegas': 'LV',
  Miami: 'MIA', Minnesota: 'MIN', 'New England': 'NE', 'New Orleans': 'NO', Philadelphia: 'PHI',
  Pittsburgh: 'PIT', 'San Francisco': 'SF', Seattle: 'SEA', 'Tampa Bay': 'TB', Tennessee: 'TEN',
  Washington: 'WSH',
}

const TEAM_PATTERNS = Object.entries(TEAMS).map(([name, abbr]) => ({
  abbr,
  name,
  re: new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9])`, 'i'),
}))

const CITY_PATTERNS = Object.entries(UNAMBIGUOUS_CITIES).map(([name, abbr]) => ({
  abbr,
  name,
  re: new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9])`, 'i'),
}))

const AMBIGUOUS_CITY_RE = /\b(New York|Los Angeles|LA|NY)\b/i

const KNOWN_SIDELINE = new Set([
  'Kaylee Hartung', 'Melissa Stark', 'Lisa Salters', 'Laura Rutledge', 'Tracy Wolfson', 'Evan Washburn',
  'Pam Oliver', 'Erin Andrews', 'Tom Rinaldi', 'Kristina Pink', 'Jen Hale', 'Allison Williams', 'AJ Ross',
  'Melanie Collins', 'Tiffany Blackmon', 'Amanda Balionis', 'Molly McGrath', 'Aditi Kinkhabwala',
  'Sara Walsh', 'Jamie Erdahl', 'Stacey Dales', 'Megan Olivi', 'Lindsay Czarniak', 'Sherree Burruss',
  'Jenny Dell', 'Tom Pelissero', 'MJ Acosta-Ruiz', 'Peter Schrager', 'Taylor Rooks',
])

const TBA_RE = /\b(TBA|TBD|TO BE ANNOUNCED)\b/i
const KICKOFF_TIME_RE = /\b\d{1,2}(:\d{2})?\s*[ap]\.?m\.?/i
const NETWORK_WORD_RE = /\b(Amazon Prime(?: Video)?|Prime Video|Netflix|Peacock|YouTube(?:\s*TV)?|NBC|CBS|FOX|ESPN(?:\s*\/\s*ABC)?|ABC|NFL\s*Network|NFLN)\b/i
const ALTCAST_SUFFIX_RE = /;\s*(?:Field Pass|ManningCast|Toy Story|Simpsons|Funday|Alt-?Cast|Spanish|Deportes|ESPN2|ESPNU|Westwood One|SiriusXM).*$/i

// Inline Yahoo/506sports line:
//   "Wednesday (8:00 p.m. ET): Green Bay Packers vs. Los Angeles Rams (Netflix - Noah Eagle, ...)"
//   "Red: New Orleans Saints vs. Cincinnati Bengals (Ian Eagle, Ross Tucker, Evan Washburn)"
const INLINE_GAME_RE = /^(.{0,70}?):\s*([^()]+\b(?:vs\.?|at)\b[^()]+)\(([^()]*)\)\s*$/i
const NETWORK_PREFIX_RE = /^(Amazon Prime(?: Video)?|Prime Video|NBC|CBS|FOX|ESPN(?:\s*\/\s*ABC)?|ABC|Netflix|Peacock|YouTube(?:\s*TV)?|NFL\s*Network|NFLN)\s*-\s*/i

// Awful Announcing schedule line:
//   "Green Bay Packers at Los Angeles Rams (8 p.m., Netflix): Noah Eagle (play-by-play), Luke Kuechly (analyst), ..."
const AA_GAME_RE = /^([^():]{3,110}?\b(?:vs\.?|at)\b[^():]{3,110}?)\(([^()]{2,80})\)\s*:\s*(.+)$/i

export const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const normalizePerson = (s) => clean(s).replace(/^JJ\b/, 'J.J.')

export function canonicalNetwork(raw) {
  const u = String(raw || '').toUpperCase()
  if (!u.trim()) return ''
  if (/PRIME|AMAZON/.test(u)) return 'Amazon Prime Video'
  if (/NETFLIX/.test(u)) return 'Netflix'
  if (/PEACOCK/.test(u)) return 'Peacock'
  if (/YOUTUBE/.test(u)) return 'YouTube'
  if (/ESPN/.test(u) && /ABC/.test(u)) return 'ESPN / ABC'
  if (/ESPN/.test(u)) return 'ESPN'
  if (/\bABC\b/.test(u)) return 'ABC'
  if (/NFL ?N/.test(u)) return 'NFL Network'
  if (/\bNBC\b/.test(u)) return 'NBC'
  if (/\bCBS\b/.test(u)) return 'CBS'
  if (/\bFOX\b/.test(u)) return 'FOX'
  return String(raw || '').trim()
}

export function getSourceDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'yahoo.com' || host.endsWith('.yahoo.com')) return 'yahoo.com'
    if (host === 'usatoday.com' || host.endsWith('.usatoday.com')) return 'usatoday.com'
    return host
  } catch {
    return String(url || 'unknown')
  }
}

/** Teams mentioned in text, in order of appearance (distinct). */
export function teamsIn(text) {
  return analyzeTeams(text).teams
}

export function analyzeTeams(text) {
  const src = clean(text)
  if (!src) return { teams: [], status: 'team name not parsed' }

  const byAbbr = new Map()
  for (const t of TEAM_PATTERNS) {
    const idx = src.search(t.re)
    if (idx >= 0 && !byAbbr.has(t.abbr)) byAbbr.set(t.abbr, idx)
  }

  // Fallback to unambiguous cities only if fewer than 2 nickname matches were found
  if (byAbbr.size < 2) {
    for (const c of CITY_PATTERNS) {
      const idx = src.search(c.re)
      if (idx >= 0 && !byAbbr.has(c.abbr)) byAbbr.set(c.abbr, idx)
    }
  }

  const ordered = [...byAbbr.entries()].sort((a, b) => a[1] - b[1]).map(([abbr]) => abbr)

  if (ordered.length > 2) {
    return { teams: ordered, status: 'ambiguous' }
  }
  if (ordered.length < 2) {
    // Bare "New York" or "Los Angeles" without Giants/Jets/Rams/Chargers is ambiguous
    if (AMBIGUOUS_CITY_RE.test(src)) {
      return { teams: ordered, status: 'ambiguous' }
    }
    return { teams: ordered, status: 'team name not parsed' }
  }
  return { teams: ordered, status: 'ok' }
}

/**
 * Parses "Ian Eagle (play-by-play), Ross Tucker (analyst), Evan Washburn (reporter)" or the plain
 * "Ian Eagle, Ross Tucker, Evan Washburn" form. Returns null for TBA / incomplete crews.
 */
export function parseCrew(text) {
  if (!text) return null
  const stripped = clean(text).replace(ALTCAST_SUFFIX_RE, '')
  if (!stripped || TBA_RE.test(stripped)) return null

  // Sources sometimes drop the comma between role segments, e.g.
  // "Greg Olsen (analyst) Pam Oliver (reporter)". Insert a separator before any
  // capitalised name that is immediately followed by a role tag.
  const normalisedText = stripped.replace(
    /\)\s+(?=[A-Z][A-Za-z.'’-]+(?:\s+[A-Za-z.'’-]+){0,3}\s*\((?:play-by-play|play by play|analyst|reporter|sideline)[^)]*\))/gi,
    '), '
  )

  let hasRoleTags = false
  const people = normalisedText
    .split(/,|;|\s+&\s+|\s+and\s+/i)
    .map((part) => {
      const role = (part.match(/\(([^)]*)\)/) || [])[1] || ''
      if (/\b(?:play[- ]by[- ]play|analyst|reporter|sideline)\b/i.test(role)) hasRoleTags = true
      const name = normalizePerson(part.replace(/\([^)]*\)/g, ''))
      return { name, role: role.toLowerCase() }
    })
    .filter((p) => /^[A-Z][A-Za-z.'’-]*(\s+[A-Z][A-Za-z.'’-]+){1,3}$/.test(p.name))

  if (people.length < 2) return null

  const isSideline = (p) => /report|sideline/.test(p.role) || (!p.role && KNOWN_SIDELINE.has(p.name))
  const pbpIdx = Math.max(0, people.findIndex((p) => /play/.test(p.role)))
  const playByPlay = people[pbpIdx].name
  const rest = people.filter((_, i) => i !== pbpIdx)
  const analysts = rest.filter((p) => !isSideline(p)).map((p) => p.name)
  const sideline = rest.filter(isSideline).map((p) => p.name)
  if (analysts.length === 0) return null
  return { playByPlay, analysts, sideline, hasRoleTags }
}

/** Checks if two parsed crews from independent sources agree. */
export function crewsAgree(a, b) {
  if (!a || !b) return false
  if (normalizePerson(a.playByPlay).toLowerCase() !== normalizePerson(b.playByPlay).toLowerCase()) {
    return false
  }
  const normList = (arr) => arr.map((x) => normalizePerson(x).toLowerCase()).sort()
  const aAll = normList([a.playByPlay, ...a.analysts, ...a.sideline])
  const bAll = normList([b.playByPlay, ...b.analysts, ...b.sideline])

  // If one source has explicit role tags (e.g. Awful Announcing) and the other does not (e.g. Yahoo),
  // identical full-crew person lists agree even if the tagless source didn't recognise a new sideline reporter.
  if (a.hasRoleTags !== b.hasRoleTags && JSON.stringify(aAll) === JSON.stringify(bAll)) {
    return true
  }

  const aAnalysts = normList(a.analysts)
  const bAnalysts = normList(b.analysts)
  if (JSON.stringify(aAnalysts) !== JSON.stringify(bAnalysts)) return false

  const aSideline = normList(a.sideline)
  const bSideline = normList(b.sideline)
  if (aSideline.length > 0 && bSideline.length > 0 && JSON.stringify(aSideline) !== JSON.stringify(bSideline)) {
    return false
  }
  return true
}

function recordPairing(pairings, issues, { away, home, crew, network, line }) {
  const key = [away, home].sort().join('|')
  const existing = pairings.get(key)
  if (existing) {
    if (existing.ambiguous) return
    if (existing.crew && crew && !crewsAgree(existing.crew, crew)) {
      existing.ambiguous = true
      existing.crew = null
      issues.push({ key, line, reason: 'ambiguous', detail: 'conflicting crews in same article', teams: [away, home] })
      return
    }
    if (!existing.crew && crew) {
      existing.crew = crew
      if (!existing.network && network) existing.network = network
    }
    return
  }
  pairings.set(key, { away, home, crew, network: network || '', ambiguous: false })
  if (!crew) {
    issues.push({ key, line, reason: 'TBA crew', teams: [away, home] })
  }
}

/**
 * Walks the article in document order and parses:
 *  - Awful Announcing schedule lines: "Team at Team (time, network): Name (play-by-play), ..."
 *  - Yahoo / 506sports inline lines: "Wednesday (8:00 p.m. ET): Team vs. Team (Netflix - Name, ...)"
 *  - Legacy Yahoo / Akron Beacon Journal "Announcers: ..." heading + paragraph lines
 */
export function parseArticle(html, url = '') {
  const $ = cheerio.load(html)
  const pairings = new Map()
  const issues = []
  let current = null

  $('h2, h3, p, li').each((_, el) => {
    if (el.tagName === 'li' && $(el).children('p').length > 0) return
    const text = clean($(el).text())
    if (!text) return

    const split = text.search(/Announcers?\s*:/i)

    if (split < 0) {
      // 1. Awful Announcing layout: "Team at Team (time, network): Name (play-by-play), ..."
      const aa = text.match(AA_GAME_RE)
      if (aa && (KICKOFF_TIME_RE.test(aa[2]) || NETWORK_WORD_RE.test(aa[2]) || TBA_RE.test(aa[2]))) {
        const analysis = analyzeTeams(aa[1])
        if (analysis.status !== 'ok') {
          issues.push({ line: text, reason: analysis.status, teams: analysis.teams })
          return
        }
        const netMatch = aa[2].match(NETWORK_WORD_RE)
        const network = netMatch ? canonicalNetwork(netMatch[1]) : ''
        const crew = parseCrew(aa[3])
        recordPairing(pairings, issues, {
          away: analysis.teams[0],
          home: analysis.teams[1],
          crew,
          network,
          line: text,
        })
        return
      }

      // 2. Yahoo / 506sports inline layout: "Wednesday (8:00 p.m. ET): Team vs. Team (Netflix - ...)"
      const m = text.match(INLINE_GAME_RE)
      if (m && m[2].length < 200) {
        const analysis = analyzeTeams(m[2])
        if (analysis.status !== 'ok') {
          issues.push({ line: text, reason: analysis.status, teams: analysis.teams })
          return
        }
        const netMatch = m[3].match(NETWORK_PREFIX_RE)
        const network = netMatch ? canonicalNetwork(netMatch[1]) : ''
        const crewText = m[3].replace(NETWORK_PREFIX_RE, '')
        const crew = parseCrew(crewText)
        recordPairing(pairings, issues, {
          away: analysis.teams[0],
          home: analysis.teams[1],
          crew,
          network,
          line: text,
        })
        return
      }

      // 3. Heading or unparsed game line (legacy <h2>Team at Team, 1 p.m., CBS</h2>)
      if (text.length < 200 && KICKOFF_TIME_RE.test(text) && /\b(at|vs\.?)\b/i.test(text)) {
        const titleSegment = text.split(/[(,]/)[0]
        const analysis = analyzeTeams(titleSegment)
        if (analysis.status === 'ok') {
          const netMatch = text.match(NETWORK_WORD_RE)
          current = { away: analysis.teams[0], home: analysis.teams[1], network: netMatch ? canonicalNetwork(netMatch[1]) : '' }
        } else {
          issues.push({ line: text, reason: analysis.status, teams: analysis.teams })
        }
      }
      return
    }

    // Legacy "Announcers:" layout (either standalone or same paragraph as matchup heading)
    const titlePart = text.slice(0, split)
    const crewPart = text.slice(split).replace(/^Announcers?\s*:\s*/i, '')

    if (titlePart.length > 0 && titlePart.length < 200 && KICKOFF_TIME_RE.test(titlePart) && /\b(at|vs\.?)\b/i.test(titlePart)) {
      const analysis = analyzeTeams(titlePart.split(/[(,]/)[0])
      if (analysis.status === 'ok') {
        const netMatch = titlePart.match(NETWORK_WORD_RE)
        current = { away: analysis.teams[0], home: analysis.teams[1], network: netMatch ? canonicalNetwork(netMatch[1]) : '' }
      } else {
        issues.push({ line: text, reason: analysis.status, teams: analysis.teams })
        current = null
      }
    }
    if (current) {
      const crew = parseCrew(crewPart)
      recordPairing(pairings, issues, {
        away: current.away,
        home: current.home,
        crew,
        network: current.network,
        line: text,
      })
      current = null
    }
  })

  return {
    title: clean($('title').first().text()),
    url,
    sourceDomain: getSourceDomain(url),
    pairings,
    issues,
  }
}

export function loadManualSources(sourcesFile = SOURCES_FILE, week = null) {
  if (!fs.existsSync(sourcesFile)) return []
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(sourcesFile, 'utf8'))
  } catch (err) {
    console.warn(`⚠️  Could not parse ${sourcesFile}: ${err.message}`)
    return []
  }

  const normalizeItem = (item) => {
    if (typeof item === 'string') return item.trim() ? { url: item.trim(), confirmed: false } : null
    if (item && typeof item === 'object' && typeof item.url === 'string' && item.url.trim()) {
      return {
        url: item.url.trim(),
        label: typeof item.label === 'string' ? item.label.trim() : undefined,
        confirmed: Boolean(item.confirmed),
      }
    }
    return null
  }

  const out = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const n = normalizeItem(item)
      if (n) out.push(n)
    }
    return out
  }

  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.urls)) {
      for (const item of raw.urls) {
        const n = normalizeItem(item)
        if (n) out.push(n)
      }
    }
    if (week != null && raw.byWeek && typeof raw.byWeek === 'object') {
      const weekList = raw.byWeek[String(week)]
      if (Array.isArray(weekList)) {
        for (const item of weekList) {
          const n = normalizeItem(item)
          if (n) out.push(n)
        }
      }
    }
  }
  return out
}

function isCandidateArticleUrl(url) {
  if (!url) return false
  if (/^https:\/\/sports\.yahoo\.com\/(?:nfl\/)?articles?\//.test(url)) return true
  if (/^https:\/\/awfulannouncing\.com\/nfl\//.test(url)) return true
  if (/^https:\/\/[a-z0-9-]+\.usatoday\.com\/story\/sports\/nfl\//.test(url)) return true
  if (/^https:\/\/www\.beaconjournal\.com\/story\/sports\/nfl\//.test(url)) return true
  return false
}

function scoreTitle(title, week) {
  const isNonNfl = /\b(college\s+football|cfb|high\s+school|nchsaa|fort\s+worth|area\s+football|prep)\b/i.test(title)
  if (isNonNfl) return -1
  const otherWeek = title.match(/\bweek\s*(\d{1,2})\b/i)
  if (otherWeek && Number(otherWeek[1]) !== week) return -1
  const hasWeek = new RegExp(`\\bweek\\s*${week}\\b`, 'i').test(title)
  const hasKeywords = /announcer|announcing|pairing|full list|broadcast/i.test(title)
  const hasNfl = /\bnfl\b/i.test(title)
  if (!hasNfl && !hasKeywords) return -1
  return (hasKeywords ? 2 : 0) + (hasWeek ? 2 : 0) + (hasNfl ? 1 : 0)
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.text()
}

/**
 * Discovers candidate article URLs in strict priority order:
 *  (a) CLI --url overrides + scripts/announcer-sources.json
 *  (b) Bing News RSS
 *  (c) Second search route: Awful Announcing search RSS2/feed, Yahoo Sports NFL RSS/page, DuckDuckGo HTML
 */
export async function discoverArticles(week, options = {}) {
  const season = options.season ?? new Date().getUTCFullYear()
  const urlOverrides = options.urlOverrides ?? []
  const sourcesFile = options.sourcesFile ?? SOURCES_FILE
  const confirmSingleSource = Boolean(options.confirmSingleSource)
  const fetchFn = options.fetchFn ?? fetch

  const ordered = new Map()
  const addCandidate = (url, meta) => {
    if (!url) return
    const existing = ordered.get(url)
    if (existing) {
      existing.confirmed = existing.confirmed || Boolean(meta.confirmed)
      existing.score = Math.max(existing.score, meta.score ?? 0)
      if (!existing.label && meta.label) existing.label = meta.label
      return
    }
    ordered.set(url, {
      url,
      label: meta.label,
      confirmed: Boolean(meta.confirmed),
      origin: meta.origin,
      score: meta.score ?? 0,
    })
  }

  // (a) CLI --url overrides and manual scripts/announcer-sources.json entries (highest priority)
  for (const u of urlOverrides) {
    addCandidate(u, { origin: 'cli', confirmed: confirmSingleSource, score: 100 })
  }
  for (const m of loadManualSources(sourcesFile, week)) {
    addCandidate(m.url, {
      origin: 'manual-config',
      label: m.label,
      confirmed: m.confirmed || confirmSingleSource,
      score: 90,
    })
  }

  // If explicit --url overrides were supplied and we aren't asked to search further, return manual first
  // (We still allow search discovery if only 1 URL was passed and confirmSingleSource is false, so a 2nd source can be discovered!)
  const manualOnly = urlOverrides.length > 0 && (urlOverrides.length >= 2 || confirmSingleSource)
  if (manualOnly) {
    return [...ordered.values()]
  }

  const discovered = new Map()
  const recordDiscovered = (url, title, origin) => {
    if (!isCandidateArticleUrl(url)) return
    const s = scoreTitle(title, week)
    if (s < 0) return
    const prev = discovered.get(url)
    if (!prev || s > prev.score) discovered.set(url, { url, title, score: s, origin })
  }

  // (b) Primary search route: Bing News RSS
  const bingQueries = [
    `site:sports.yahoo.com TV broadcast maps and announcers for Week ${week}`,
    `site:sports.yahoo.com NFL announcer schedule pairings week ${week}`,
    `site:awfulannouncing.com NFL week ${week} announcing schedule ${season}`,
    `beaconjournal games and announcers for week ${week} of the NFL season`,
  ]
  for (const q of bingQueries) {
    try {
      const res = await fetchFn(`https://www.bing.com/news/search?format=rss&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const $ = cheerio.load(await res.text(), { xmlMode: true })
      $('item').each((_, item) => {
        const link = $(item).children('link').text()
        let real = link
        try {
          real = new URL(link.replace(/&amp;/g, '&')).searchParams.get('url') || link
        } catch {
          /* keep raw link */
        }
        const title = clean($(item).children('title').text())
        recordDiscovered(real, title, 'bing-rss')
      })
    } catch {
      /* try next query */
    }
  }

  // (c) Secondary search route: Awful Announcing WordPress search RSS2 + NFL feed,
  //     Yahoo Sports NFL RSS/page, and DuckDuckGo HTML fallback
  const rssUrls = [
    `https://awfulannouncing.com/search/${encodeURIComponent(`NFL Week ${week} announcing schedule ${season}`).replace(/%20/g, '+')}/feed/rss2/`,
    'https://awfulannouncing.com/nfl/feed',
    'https://sports.yahoo.com/nfl/rss/',
  ]
  for (const feedUrl of rssUrls) {
    try {
      const res = await fetchFn(feedUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const $ = cheerio.load(await res.text(), { xmlMode: true })
      $('item').each((_, item) => {
        const link = clean($(item).children('link').text())
        const title = clean($(item).children('title').text())
        recordDiscovered(link, title, 'site-rss')
      })
    } catch {
      /* ignore */
    }
  }

  // Yahoo Sports NFL index page fallback
  try {
    const res = await fetchFn('https://sports.yahoo.com/nfl/', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const $ = cheerio.load(await res.text())
      $('a[href]').each((_, a) => {
        const href = $(a).attr('href') || ''
        const full = href.startsWith('/') ? `https://sports.yahoo.com${href}` : href
        const title = clean($(a).text())
        if (new RegExp(`week\\s*${week}\\b`, 'i').test(title) && /announcer|broadcast|map/i.test(title)) {
          recordDiscovered(full, title, 'yahoo-nfl')
        }
      })
    }
  } catch {
    /* ignore */
  }

  // DuckDuckGo HTML fallback
  const ddgQueries = [
    `site:sports.yahoo.com NFL TV broadcast maps announcers Week ${week} ${season}`,
    `site:awfulannouncing.com NFL Week ${week} announcing schedule ${season}`,
  ]
  for (const q of ddgQueries) {
    try {
      const res = await fetchFn(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      })
      if (res.status !== 200) continue
      const $ = cheerio.load(await res.text())
      $('a.result__a, a[href*="uddg="]').each((_, a) => {
        const href = $(a).attr('href') || ''
        let target = href
        try {
          const parsed = new URL(href, 'https://html.duckduckgo.com')
          target = parsed.searchParams.get('uddg') || href
        } catch {
          /* ignore */
        }
        recordDiscovered(target, clean($(a).text()), 'duckduckgo')
      })
    } catch {
      /* ignore */
    }
  }

  const sortedDiscovered = [...discovered.values()].sort((a, b) => b.score - a.score)
  for (const item of sortedDiscovered) {
    addCandidate(item.url, {
      origin: item.origin,
      confirmed: confirmSingleSource,
      score: item.score,
    })
  }
  return [...ordered.values()]
}

/**
 * Derives target weeks from ESPN's calendar for the next 10 days (plus --week / --weeks overrides).
 * Ensures holiday-week games (Wednesday Thanksgiving Eve, Thursday tripleheader, Black Friday,
 * Christmas Day Friday, Saturday games) are never missed even when run before ESPN's week flips.
 */
export function resolveTargetWeeks(firstData, options = {}) {
  const season = firstData?.season?.year
  const currentSeasonType = firstData?.season?.type ?? 2
  const currentWeek = firstData?.week?.number
  const weekOverride = options.weekOverride ?? null
  const weeksArg = Math.max(1, options.weeks ?? 1)
  const nowMs = options.nowMs ?? Date.now()

  if (!season || !currentWeek) {
    throw new Error('ESPN response is missing season/week')
  }

  if (weekOverride != null) {
    const out = []
    for (let i = 0; i < weeksArg; i++) {
      out.push({ season, seasonType: currentSeasonType, week: weekOverride + i, windowStart: null, windowEnd: null })
    }
    return out
  }

  const windowStart = nowMs
  const windowEnd = nowMs + TEN_DAYS_MS
  const targets = new Map()

  const calendar = firstData?.leagues?.[0]?.calendar || []
  for (const group of calendar) {
    const st = Number(group.value)
    if (![1, 2, 3].includes(st) || !Array.isArray(group.entries)) continue
    for (const entry of group.entries) {
      const wk = Number(entry.value)
      const sMs = Date.parse(entry.startDate)
      const eMs = Date.parse(entry.endDate)
      if (!Number.isFinite(wk) || !Number.isFinite(sMs) || !Number.isFinite(eMs)) continue
      if (eMs >= windowStart && sMs <= windowEnd) {
        targets.set(`${st}|${wk}`, {
          season,
          seasonType: st,
          week: wk,
          windowStart: entry.startDate,
          windowEnd: entry.endDate,
        })
      }
    }
  }

  // Ensure at least `weeksArg` weeks starting from currentWeek are included
  for (let i = 0; i < weeksArg; i++) {
    const wk = currentWeek + i
    const key = `${currentSeasonType}|${wk}`
    if (!targets.has(key)) {
      const group = calendar.find((g) => Number(g.value) === currentSeasonType)
      const entry = group?.entries?.find((e) => Number(e.value) === wk)
      targets.set(key, {
        season,
        seasonType: currentSeasonType,
        week: wk,
        windowStart: entry?.startDate ?? null,
        windowEnd: entry?.endDate ?? null,
      })
    }
  }

  return [...targets.values()].sort((a, b) => a.seasonType - b.seasonType || a.week - b.week)
}

export function scheduleGames(data, season, week) {
  return (data.events || []).map((event) => {
    const comp = event.competitions?.[0]
    const away = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'away')?.team?.abbreviation)
    const home = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'home')?.team?.abbreviation)
    const network = canonicalNetwork((comp?.broadcasts || []).flatMap((b) => b.names || []).join(', '))
    return {
      season,
      week,
      away,
      home,
      network,
      kickoffUtc: event.date,
      key: [away, home].sort().join('|'),
    }
  })
}

function sourceLabelFor(article) {
  if (article.label) return article.label
  if (article.title) return article.title
  if (article.sourceDomain === 'awfulannouncing.com') {
    return 'Awful Announcing — NFL announcing schedule'
  }
  return 'Yahoo Sports / 506sports — NFL schedule and announcer pairings'
}

/**
 * Reconciles ESPN games for a single week against parsed articles.
 * Requires 2 independent source domains that agree (or 1 source with confirmSingleSource).
 * Never writes TBA or conflicting crews, and classifies every unmatched game with its reason.
 */
export function reconcileWeek(games, articles, options = {}) {
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const confirmSingleSource = Boolean(options.confirmSingleSource)
  const windowStartMs = options.windowStart ? Date.parse(options.windowStart) : null
  const windowEndMs = options.windowEnd ? Date.parse(options.windowEnd) : null
  const checkRegistry = options.checkRegistry ?? findVerifiedCrew

  const newEntries = []
  const unmatched = []
  const conflicts = []

  const allIssues = articles.flatMap((a) => a.issues || [])

  for (const g of games) {
    if (checkRegistry(g.season, g.week, g.away, g.home)) continue

    // Check week window bounds if known
    const kickoffMs = Date.parse(g.kickoffUtc)
    if (
      !Number.isFinite(kickoffMs) ||
      (Number.isFinite(windowStartMs) && kickoffMs < windowStartMs) ||
      (Number.isFinite(windowEndMs) && kickoffMs > windowEndMs)
    ) {
      unmatched.push({
        game: g,
        reason: 'kickoff outside the week window',
        detail: `kickoff ${g.kickoffUtc} outside [${options.windowStart}, ${options.windowEnd}]`,
      })
      continue
    }

    // Group observations by independent source domain
    const byDomain = new Map()
    let hasAmbiguous = false
    let hasTba = false

    for (const art of articles) {
      const obs = art.pairings.get(g.key)
      if (!obs) continue
      if (obs.ambiguous) {
        hasAmbiguous = true
        continue
      }
      if (!obs.crew) {
        hasTba = true
        continue
      }
      const dom = art.sourceDomain || getSourceDomain(art.url)
      if (!byDomain.has(dom)) byDomain.set(dom, [])
      byDomain.get(dom).push({ ...obs, article: art })
    }

    // Detect intra-domain disagreement if multiple articles from the same domain disagreed
    const validPerDomain = []
    for (const [dom, list] of byDomain.entries()) {
      const base = list[0]
      const intraConflict = list.slice(1).some((other) => !crewsAgree(base.crew, other.crew))
      if (intraConflict) {
        hasAmbiguous = true
      } else {
        // Prefer any entry from this domain that has role tags or explicit confirmation
        const best = list.find((x) => x.crew.hasRoleTags) || list.find((x) => x.article.confirmed) || base
        validPerDomain.push({ domain: dom, obs: best })
      }
    }

    if (hasAmbiguous) {
      unmatched.push({
        game: g,
        reason: 'ambiguous',
        detail: 'conflicting or duplicate ambiguous pairings within source(s)',
      })
      continue
    }

    if (validPerDomain.length === 0) {
      if (hasTba) {
        unmatched.push({ game: g, reason: 'TBA crew', detail: 'listed as TBA/TBD or incomplete in source' })
        continue
      }
      // Check if an unparsed/ambiguous line in an article referenced either team
      const relatedIssue = allIssues.find(
        (iss) =>
          (iss.reason === 'team name not parsed' || iss.reason === 'ambiguous') &&
          Array.isArray(iss.teams) &&
          (iss.teams.includes(g.away) || iss.teams.includes(g.home))
      )
      if (relatedIssue) {
        unmatched.push({ game: g, reason: relatedIssue.reason, detail: relatedIssue.line })
      } else {
        unmatched.push({ game: g, reason: 'no pairing found', detail: 'matchup absent from discovered articles' })
      }
      continue
    }

    // Check agreement across all independent domains
    const firstObs = validPerDomain[0].obs
    let conflictMsg = null
    for (let i = 1; i < validPerDomain.length; i++) {
      const otherObs = validPerDomain[i].obs
      if (!crewsAgree(firstObs.crew, otherObs.crew)) {
        conflictMsg = `${validPerDomain[0].domain} (${firstObs.crew.playByPlay}/${firstObs.crew.analysts.join(', ')}) vs ${validPerDomain[i].domain} (${otherObs.crew.playByPlay}/${otherObs.crew.analysts.join(', ')})`
        break
      }
    }

    if (conflictMsg) {
      conflicts.push({ game: g, detail: conflictMsg })
      unmatched.push({ game: g, reason: 'ambiguous', detail: `source conflict: ${conflictMsg}` })
      continue
    }

    // Two-source rule: require >= 2 independent domains, OR 1 domain with explicit manual confirmation
    const isConfirmedSingle =
      validPerDomain.length === 1 &&
      (confirmSingleSource || validPerDomain.some((d) => Boolean(d.obs.article.confirmed)))

    if (validPerDomain.length < 2 && !isConfirmedSingle) {
      unmatched.push({
        game: g,
        reason: 'single source only',
        detail: `found in 1 source (${validPerDomain[0].domain}); requires 2 independent sources or --confirm-single-source`,
      })
      continue
    }

    const bestObs = (validPerDomain.find((d) => d.obs.crew.hasRoleTags) || validPerDomain[0]).obs
    const network = g.network || bestObs.network || validPerDomain.map((d) => d.obs.network).find(Boolean) || ''
    if (!network) {
      unmatched.push({ game: g, reason: 'no pairing found', detail: 'network not yet published by ESPN or sources' })
      continue
    }

    const sources = validPerDomain.map((d) => ({
      label: sourceLabelFor(d.obs.article),
      url: d.obs.article.url,
    }))

    newEntries.push({
      season: g.season,
      week: g.week,
      away: g.away,
      home: g.home,
      kickoffUtc: g.kickoffUtc,
      network,
      playByPlay: bestObs.crew.playByPlay,
      analysts: bestObs.crew.analysts,
      sideline: bestObs.crew.sideline,
      sources,
      verifiedOn: today,
    })
  }

  return { newEntries, unmatched, conflicts }
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const list = (a) => a.map(q).join(', ')

function renderEntry(e) {
  const sourcesStr = e.sources
    .map((s) => `{ label: ${q(s.label)}, url: ${q(s.url)} }`)
    .join(', ')
  return `  {
    season: ${e.season}, week: ${e.week}, away: ${q(e.away)}, home: ${q(e.home)}, kickoffUtc: ${q(e.kickoffUtc)},
    network: ${q(e.network)},
    playByPlay: ${q(e.playByPlay)}, analysts: [${list(e.analysts)}], sideline: [${list(e.sideline)}],
    sources: [${sourcesStr}],
    verifiedOn: ${q(e.verifiedOn)},
  },`
}

/** Rewrites the registry file with the new entries appended inside ANNOUNCER_REGISTRY. */
function injectEntries(entries) {
  const code = fs.readFileSync(REGISTRY_FILE, 'utf8')
  const start = code.indexOf('export const ANNOUNCER_REGISTRY')
  if (start < 0) throw new Error('ANNOUNCER_REGISTRY declaration not found')
  const close = code.indexOf('\n]', start)
  if (close < 0) throw new Error('Closing bracket of ANNOUNCER_REGISTRY not found')
  const block = `\n  // Auto-ingested by scripts/update-announcers.mjs\n${entries.map(renderEntry).join('\n')}`
  fs.writeFileSync(REGISTRY_FILE, code.slice(0, close) + block + code.slice(close), 'utf8')
}

async function fetchAndParseArticles(games, week, candidates) {
  const wanted = new Set(games.map((g) => g.key))
  const parsed = []
  for (const c of candidates) {
    let art
    try {
      art = parseArticle(await fetchHtml(c.url), c.url)
    } catch (err) {
      console.log(`  skip ${c.url}: ${err.message}`)
      continue
    }
    const otherWeek = art.title.match(/\bweek\s*(\d{1,2})\b/i)
    if (otherWeek && Number(otherWeek[1]) !== week) {
      console.log(`  skip ${c.url}: title targets Week ${otherWeek[1]}, not Week ${week}`)
      continue
    }
    const matched = [...art.pairings.keys()].filter((k) => wanted.has(k))
    const outside = [...art.pairings.keys()].filter((k) => !wanted.has(k))
    console.log(
      `  ${c.url} [${c.origin}]\n` +
        `    parsed ${art.pairings.size} pairings, ${matched.length} match ESPN week ${week}` +
        (outside.length ? `, ${outside.length} outside week schedule (${outside.join(', ')})` : '')
    )
    if (art.issues.length > 0) {
      for (const iss of art.issues) {
        console.log(`    [parse issue] ${iss.reason}: ${iss.line}`)
      }
    }
    parsed.push({ ...art, confirmed: c.confirmed, label: c.label })
  }
  return parsed
}

function parseCliArgs(argv) {
  const urlOverrides = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) {
      for (const part of argv[i + 1].split(/[\s,]+/)) {
        if (part.trim()) urlOverrides.push(part.trim())
      }
      i++
    }
  }
  const argValue = (name, fallback) => {
    const i = argv.indexOf(name)
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
  }
  return {
    DRY_RUN: argv.includes('--dry-run'),
    STRICT: argv.includes('--strict'),
    CONFIRM_SINGLE_SOURCE:
      argv.includes('--confirm-single-source') || argv.includes('--confirm') || argv.includes('--manual-confirm'),
    URL_OVERRIDES: urlOverrides,
    WEEKS: Math.max(1, Number(argValue('--weeks', 1))),
    WEEK_OVERRIDE: argValue('--week', null) ? Number(argValue('--week')) : null,
    REPORT_FILE: argValue('--report-file', null),
  }
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2))
  const first = await fetchJson(ESPN_API)
  const targetWeeks = resolveTargetWeeks(first, {
    weekOverride: cli.WEEK_OVERRIDE,
    weeks: cli.WEEKS,
  })

  const today = new Date().toISOString().slice(0, 10)
  const allNewEntries = []
  const allUnmatched = []
  const allConflicts = []

  for (const target of targetWeeks) {
    const { season, seasonType, week, windowStart, windowEnd } = target
    const isFirstDefault = seasonType === (first.season?.type ?? 2) && week === first.week?.number
    const data = isFirstDefault ? first : await fetchJson(`${ESPN_API}?seasontype=${seasonType}&week=${week}`)
    const games = scheduleGames(data, season, week)
    console.log(`Week ${week} (seasontype ${seasonType}): ${games.length} ESPN games`)

    const candidates = (
      await discoverArticles(week, {
        season,
        urlOverrides: cli.URL_OVERRIDES,
        confirmSingleSource: cli.CONFIRM_SINGLE_SOURCE,
      })
    ).slice(0, 14)

    if (!candidates.length) console.log(`Week ${week}: no pairings article found yet`)
    const articles = await fetchAndParseArticles(games, week, candidates)

    const { newEntries, unmatched, conflicts } = reconcileWeek(games, articles, {
      today,
      confirmSingleSource: cli.CONFIRM_SINGLE_SOURCE,
      windowStart,
      windowEnd,
    })

    allNewEntries.push(...newEntries)
    allUnmatched.push(...unmatched)
    allConflicts.push(...conflicts)
  }

  for (const c of allConflicts) {
    console.warn(`⚠️  CONFLICT (not written) W${c.game.week} ${c.game.away}@${c.game.home}: ${c.detail}`)
  }

  if (allUnmatched.length) {
    console.log(`\nUnmatched ESPN games (${allUnmatched.length}):`)
    for (const u of allUnmatched) {
      console.log(`  - W${u.game.week} ${u.game.away}@${u.game.home} (${u.game.kickoffUtc}): ${u.reason}${u.detail ? ` — ${u.detail}` : ''}`)
    }
  }

  if (cli.REPORT_FILE) {
    fs.writeFileSync(
      cli.REPORT_FILE,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          targetWeeks: targetWeeks.map((t) => ({ season: t.season, seasonType: t.seasonType, week: t.week })),
          injectedCount: allNewEntries.length,
          conflicts: allConflicts.map((c) => ({
            week: c.game.week,
            away: c.game.away,
            home: c.game.home,
            detail: c.detail,
          })),
          unmatched: allUnmatched.map((u) => ({
            season: u.game.season,
            week: u.game.week,
            away: u.game.away,
            home: u.game.home,
            kickoffUtc: u.game.kickoffUtc,
            reason: u.reason,
            detail: u.detail,
          })),
        },
        null,
        2
      ),
      'utf8'
    )
  }

  if (!allNewEntries.length) {
    console.log('No new crews to inject; registry unchanged.')
    return
  }

  for (const e of allNewEntries) {
    console.log(
      `+ W${e.week} ${e.away}@${e.home} (${e.network}): ${e.playByPlay} / ${e.analysts.join(', ')} / ${e.sideline.join(', ')} [${e.sources.length} source(s)]`
    )
  }
  if (cli.DRY_RUN) {
    console.log('--dry-run: registry not modified.')
    return
  }
  injectEntries(allNewEntries)
  console.log(`✅ Injected ${allNewEntries.length} crew(s) into src/data/announcerRegistry.ts`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const strict = process.argv.includes('--strict')
  main().catch((err) => {
    console.warn(`⚠️  Announcer update skipped: ${err.message}`)
    process.exitCode = strict ? 1 : 0
  })
}
