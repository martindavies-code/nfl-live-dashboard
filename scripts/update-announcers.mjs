#!/usr/bin/env node
/**
 * Automated weekly announcer ingestion (pre-audit step).
 *
 *  1. Reads the live schedule (season, week, kickoff, network) from ESPN - the same source the audit uses.
 *  2. Finds this week's published pairings article (Yahoo Sports / Akron Beacon Journal list) via Bing News RSS,
 *     or uses --url. (506sports sits behind a Cloudflare JS challenge, so it cannot be fetched headlessly.)
 *  3. Fetches it with native fetch + browser headers and parses it with cheerio.
 *  4. Maps team names to ESPN abbreviations, matches each pairing to an ESPN game, and injects NEW crews into
 *     ANNOUNCER_REGISTRY in src/data/announcerRegistry.ts (file is rewritten).
 *
 * Safety rules (see header of announcerRegistry.ts):
 *  - A crew listed as TBA / TBD / incomplete is NEVER written; the game stays "Crew TBA" and the audit keeps
 *    flagging it.
 *  - Existing (hand-verified) entries are never overwritten, so the script is idempotent.
 *  - A pairing only counts if it matches a game on ESPN's schedule for the target week, so a wrong-week
 *    article cannot inject anything.
 *  - If no article can be found/fetched, the script warns and exits 0 without touching the file (the audit
 *    that runs next still reports the truth). Use --strict to exit 1 instead.
 *
 * Usage:
 *   node --experimental-strip-types scripts/update-announcers.mjs [--week N] [--weeks 2] [--url <article>]
 *                                                                 [--dry-run] [--strict]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { findVerifiedCrew, normalizeTeamAbbr } from '../src/data/announcerRegistry.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY_FILE = path.resolve(__dirname, '../src/data/announcerRegistry.ts')
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
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

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback
}
const DRY_RUN = args.includes('--dry-run')
const STRICT = args.includes('--strict')
const URL_OVERRIDE = argValue('--url', null)
const WEEKS = Math.max(1, Number(argValue('--weeks', 1)))
const WEEK_OVERRIDE = argValue('--week', null) ? Number(argValue('--week')) : null

// Nicknames -> ESPN abbreviations (city-only names are ambiguous, so nicknames are the key).
const TEAMS = {
  Cardinals: 'ARI', Falcons: 'ATL', Ravens: 'BAL', Bills: 'BUF', Panthers: 'CAR', Bears: 'CHI',
  Bengals: 'CIN', Browns: 'CLE', Cowboys: 'DAL', Broncos: 'DEN', Lions: 'DET', Packers: 'GB',
  Texans: 'HOU', Colts: 'IND', Jaguars: 'JAX', Chiefs: 'KC', Chargers: 'LAC', Rams: 'LAR',
  Raiders: 'LV', Dolphins: 'MIA', Vikings: 'MIN', Patriots: 'NE', Saints: 'NO', Giants: 'NYG',
  Jets: 'NYJ', Eagles: 'PHI', Steelers: 'PIT', Seahawks: 'SEA', '49ers': 'SF', Buccaneers: 'TB',
  Titans: 'TEN', Commanders: 'WSH',
}
const TEAM_PATTERNS = Object.entries(TEAMS).map(([name, abbr]) => ({
  abbr,
  re: new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9])`, 'i'),
}))

const KNOWN_SIDELINE = new Set([
  'Kaylee Hartung', 'Melissa Stark', 'Lisa Salters', 'Laura Rutledge', 'Tracy Wolfson', 'Evan Washburn',
  'Pam Oliver', 'Erin Andrews', 'Tom Rinaldi', 'Kristina Pink', 'Jen Hale', 'Allison Williams', 'AJ Ross',
  'Melanie Collins', 'Tiffany Blackmon', 'Amanda Balionis', 'Molly McGrath', 'Aditi Kinkhabwala',
  'Sara Walsh', 'Jamie Erdahl', 'Stacey Dales', 'Megan Olivi', 'Lindsay Czarniak', 'Sherree Burruss',
  'Jenny Dell',
])

const TBA_RE = /\b(TBA|TBD|TO BE ANNOUNCED)\b/i
const KICKOFF_TIME_RE = /\b\d{1,2}(:\d{2})?\s*[ap]\.?m\.?/i

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

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

/** Teams mentioned in text, in order of appearance (distinct). */
function teamsIn(text) {
  return TEAM_PATTERNS.map((t) => ({ abbr: t.abbr, idx: text.search(t.re) }))
    .filter((t) => t.idx >= 0)
    .sort((a, b) => a.idx - b.idx)
    .map((t) => t.abbr)
}

/**
 * Parses "Ian Eagle (play-by-play), Ross Tucker (analyst), Evan Washburn (reporter)" or the plain
 * "Ian Eagle, Ross Tucker, Evan Washburn" form. Returns null for TBA / incomplete crews.
 */
function parseCrew(text) {
  if (!text || TBA_RE.test(text)) return null
  const people = text
    .split(/,|;|\s+&\s+|\s+and\s+/i)
    .map((part) => {
      const role = (part.match(/\(([^)]*)\)/) || [])[1] || ''
      const name = clean(part.replace(/\([^)]*\)/g, '')).replace(/^JJ\b/, 'J.J.')
      return { name, role: role.toLowerCase() }
    })
    .filter((p) => /^[A-Z][A-Za-z.'’-]*(\s+[A-Za-z.'’-]+){1,3}$/.test(p.name))
  if (people.length < 2) return null

  const isSideline = (p) => /report|sideline/.test(p.role) || (!p.role && KNOWN_SIDELINE.has(p.name))
  const pbpIdx = Math.max(0, people.findIndex((p) => /play/.test(p.role)))
  const playByPlay = people[pbpIdx].name
  const rest = people.filter((_, i) => i !== pbpIdx)
  const analysts = rest.filter((p) => !isSideline(p)).map((p) => p.name)
  const sideline = rest.filter(isSideline).map((p) => p.name)
  if (analysts.length === 0) return null
  return { playByPlay, analysts, sideline }
}

/**
 * Walks the article in document order. A heading/paragraph that names two teams and a kickoff time sets the
 * current game; an "Announcer(s): ..." line (separate paragraph, or inline in the same one) supplies its crew.
 * Handles both known layouts (Yahoo <h2 class="heading"> list and the bold-title paragraph list).
 */
function parseArticle(html) {
  const $ = cheerio.load(html)
  const pairings = new Map()
  let current = null
  $('h2, h3, p').each((_, el) => {
    const text = clean($(el).text())
    if (!text) return
    const split = text.search(/Announcers?\s*:/i)
    const titlePart = split >= 0 ? text.slice(0, split) : text
    const crewPart = split >= 0 ? text.slice(split).replace(/^Announcers?\s*:\s*/i, '') : null

    if (titlePart.length < 200 && KICKOFF_TIME_RE.test(titlePart) && /\b(at|vs\.?)\b/i.test(titlePart)) {
      const teams = teamsIn(titlePart.split(/[(,]/)[0])
      if (teams.length === 2) current = { away: teams[0], home: teams[1] }
    }
    if (crewPart !== null && current) {
      const key = [current.away, current.home].sort().join('|')
      if (!pairings.has(key)) pairings.set(key, parseCrew(crewPart))
      current = null
    }
  })
  return { title: clean($('title').first().text()), pairings }
}

/** Finds candidate article URLs for a week via Bing News RSS (direct, server-rendered Yahoo pages only). */
async function discoverArticles(week) {
  const queries = [
    `site:sports.yahoo.com NFL announcer schedule pairings week ${week}`,
    `beaconjournal games and announcers for week ${week} of the NFL season`,
    `site:sports.yahoo.com NFL week ${week} announcers full list`,
  ]
  const scored = new Map()
  for (const q of queries) {
    try {
      const res = await fetch(`https://www.bing.com/news/search?format=rss&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const $ = cheerio.load(await res.text(), { xmlMode: true })
      $('item').each((_, item) => {
        const link = $(item).children('link').text()
        const real = new URL(link.replace(/&amp;/g, '&')).searchParams.get('url') || link
        if (!/^https:\/\/sports\.yahoo\.com\/articles\//.test(real)) return
        const title = $(item).children('title').text()
        // Rank by headline relevance so the cap below never drops the real article.
        const score = (/announcer|pairing|full list|broadcast/i.test(title) ? 2 : 0) + (new RegExp(`week\\s*${week}\\b`, 'i').test(title) ? 1 : 0)
        scored.set(real, Math.max(scored.get(real) ?? 0, score))
      })
    } catch {
      /* try next query */
    }
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u)
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const list = (a) => a.map(q).join(', ')

function renderEntry(e) {
  return `  {
    season: ${e.season}, week: ${e.week}, away: ${q(e.away)}, home: ${q(e.home)}, kickoffUtc: ${q(e.kickoffUtc)},
    network: ${q(e.network)},
    playByPlay: ${q(e.playByPlay)}, analysts: [${list(e.analysts)}], sideline: [${list(e.sideline)}],
    sources: [{ label: ${q(e.source.label)}, url: ${q(e.source.url)} }],
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

/** ESPN labels -> the network names the registry (and its test) use. Unknown labels pass through unchanged. */
function canonicalNetwork(raw) {
  const u = String(raw || '').toUpperCase()
  if (/PRIME|AMAZON/.test(u)) return 'Amazon Prime Video'
  if (/ESPN/.test(u) && /ABC/.test(u)) return 'ESPN / ABC'
  if (/NFL ?N/.test(u)) return 'NFL Network'
  if (u === 'FOX') return 'FOX'
  return String(raw || '')
}

function scheduleGames(data, season, week) {
  return (data.events || []).map((event) => {
    const comp = event.competitions?.[0]
    const away = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'away')?.team?.abbreviation)
    const home = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'home')?.team?.abbreviation)
    const network = canonicalNetwork((comp?.broadcasts || []).flatMap((b) => b.names || []).join(', '))
    return { season, week, away, home, network, kickoffUtc: event.date, key: [away, home].sort().join('|') }
  })
}

/** Returns Map(key -> { crew, url, title }) of article pairings that match this week's ESPN games. */
async function collectPairings(games, week) {
  const urls = URL_OVERRIDE ? [URL_OVERRIDE] : (await discoverArticles(week)).slice(0, 12)
  if (!urls.length) console.log(`Week ${week}: no pairings article found yet`)
  const wanted = new Set(games.map((g) => g.key))
  const found = new Map()
  for (const url of urls) {
    let article
    try {
      article = parseArticle(await fetchHtml(url))
    } catch (err) {
      console.log(`  skip ${url}: ${err.message}`)
      continue
    }
    const otherWeek = article.title.match(/\bweek\s*(\d{1,2})\b/i)
    if (otherWeek && Number(otherWeek[1]) !== week) continue
    const matched = [...article.pairings.keys()].filter((k) => wanted.has(k))
    console.log(`  ${url}\n    parsed ${article.pairings.size} pairings, ${matched.length} match ESPN week ${week}`)
    for (const k of matched) {
      const crew = article.pairings.get(k)
      if (!found.has(k) || (crew && !found.get(k).crew)) found.set(k, { crew, url, title: article.title })
    }
  }
  return found
}

async function main() {
  const first = await fetchJson(ESPN_API)
  const season = first.season?.year
  const seasonType = first.season?.type ?? 2
  const startWeek = WEEK_OVERRIDE ?? first.week?.number
  if (!season || !startWeek) throw new Error('ESPN response is missing season/week')

  const today = new Date().toISOString().slice(0, 10)
  const newEntries = []
  const tba = []

  for (let i = 0; i < WEEKS; i++) {
    const week = startWeek + i
    const data = i === 0 && !WEEK_OVERRIDE ? first : await fetchJson(`${ESPN_API}?seasontype=${seasonType}&week=${week}`)
    const games = scheduleGames(data, season, week)
    console.log(`Week ${week}: ${games.length} ESPN games`)
    const found = await collectPairings(games, week)

    for (const g of games) {
      if (findVerifiedCrew(season, week, g.away, g.home)) continue // never overwrite verified data
      const hit = found.get(g.key)
      if (!hit?.crew || !g.network) {
        tba.push(`W${week} ${g.away}@${g.home}${hit ? ' (crew TBA)' : ' (not in article)'}`)
        continue
      }
      newEntries.push({
        ...g, ...hit.crew,
        source: { label: `Yahoo Sports / Akron Beacon Journal — NFL schedule and announcer pairings for Week ${week}`, url: hit.url },
        verifiedOn: today,
      })
    }
  }

  if (tba.length) console.log(`Left as Crew TBA (not written): ${tba.join('; ')}`)
  if (!newEntries.length) return console.log('No new crews to inject; registry unchanged.')

  for (const e of newEntries) console.log(`+ W${e.week} ${e.away}@${e.home} (${e.network}): ${e.playByPlay} / ${e.analysts.join(', ')} / ${e.sideline.join(', ')}`)
  if (DRY_RUN) return console.log('--dry-run: registry not modified.')
  injectEntries(newEntries)
  console.log(`✅ Injected ${newEntries.length} crew(s) into src/data/announcerRegistry.ts`)
}

main().catch((err) => {
  console.warn(`⚠️  Announcer update skipped: ${err.message}`)
  process.exitCode = STRICT ? 1 : 0
})
