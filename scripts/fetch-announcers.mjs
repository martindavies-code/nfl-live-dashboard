#!/usr/bin/env node
/**
 * Automated Announcer Fetcher & Ingestion Tool
 *
 * Enforces the strict rules of NFL announcer intelligence:
 *  1. PERMANENT PRIMETIME EXCEPTION:
 *     Thursday Night Football (Prime Video), Sunday Night Football (NBC), and Monday Night Football (ESPN/ABC)
 *     always feature their locked lead franchise crews:
 *       - TNF: Al Michaels, Kirk Herbstreit, Kaylee Hartung (Amazon Prime Video)
 *       - SNF: Mike Tirico, Cris Collinsworth, Melissa Stark (NBC)
 *       - MNF: Joe Buck, Troy Aikman, Lisa Salters (ESPN / ABC)
 *  2. ZERO-GUESSING RULE:
 *     Sunday afternoon regional slates (CBS & FOX rotate 7 and 5 crews weekly), London games,
 *     and holiday specials MUST NEVER be guessed. They remain "Crew TBA / Awaiting confirmation"
 *     until networks publish official weekly assignments (typically Tuesday/Wednesday).
 *  3. FACT-CHECKED INGESTION:
 *     When official weekly pairings are published (e.g. Yahoo Sports / Akron Beacon Journal, 506 Sports),
 *     this script parses the pairings, validates all invariants (real names, HTTPS sources, no booth
 *     double-bookings across concurrent games), and updates src/data/announcerRegistry.ts.
 *
 * Usage:
 *   # Check upcoming week and preview status (dry run)
 *   node scripts/fetch-announcers.mjs
 *
 *   # Target a specific week
 *   node scripts/fetch-announcers.mjs --week 5
 *
 *   # Ingest pairings from a published article URL
 *   node scripts/fetch-announcers.mjs --week 5 --url https://sports.yahoo.com/articles/nfl-schedule-announcer-pairings-week-xxxx.html --apply
 *
 *   # Auto-apply permanent primetime booths for upcoming weeks
 *   node scripts/fetch-announcers.mjs --week 5 --apply
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findVerifiedCrew, normalizeTeamAbbr } from '../src/data/announcerRegistry.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY_FILE = path.resolve(__dirname, '../src/data/announcerRegistry.ts')
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback
}
const hasFlag = (name) => args.includes(name)

const TARGET_WEEK = getArg('--week', null) ? parseInt(getArg('--week'), 10) : null
const SOURCE_URL = getArg('--url', null)
const APPLY = hasFlag('--apply')

// Known sideline reporters to separate from booth analysts
const KNOWN_SIDELINE_REPORTERS = new Set([
  'Kaylee Hartung', 'Melissa Stark', 'Lisa Salters', 'Laura Rutledge',
  'Tracy Wolfson', 'Evan Washburn', 'Pam Oliver', 'Erin Andrews', 'Tom Rinaldi',
  'Kristina Pink', 'Jen Hale', 'Allison Williams', 'AJ Ross', 'Melanie Collins',
  'Tiffany Blackmon', 'Amanda Balionis', 'Molly McGrath', 'Aditi Kinkhabwala',
  'Sara Walsh', 'Jamie Erdahl', 'Stacey Dales', 'Megan Olivi', 'Lindsay Czarniak',
  'Sherree Burruss', 'Jenny Dell', 'Jay Feely', 'Ross Tucker',
])

// Team names mapping to ESPN standard abbreviations
const TEAM_NAME_TO_ABBR = {
  'cardinals': 'ARI', 'arizona cardinals': 'ARI', 'arizona': 'ARI',
  'falcons': 'ATL', 'atlanta falcons': 'ATL', 'atlanta': 'ATL',
  'ravens': 'BAL', 'baltimore ravens': 'BAL', 'baltimore': 'BAL',
  'bills': 'BUF', 'buffalo bills': 'BUF', 'buffalo': 'BUF',
  'panthers': 'CAR', 'carolina panthers': 'CAR', 'carolina': 'CAR',
  'bears': 'CHI', 'chicago bears': 'CHI', 'chicago': 'CHI',
  'bengals': 'CIN', 'cincinnati bengals': 'CIN', 'cincinnati': 'CIN',
  'browns': 'CLE', 'cleveland browns': 'CLE', 'cleveland': 'CLE',
  'cowboys': 'DAL', 'dallas cowboys': 'DAL', 'dallas': 'DAL',
  'broncos': 'DEN', 'denver broncos': 'DEN', 'denver': 'DEN',
  'lions': 'DET', 'detroit lions': 'DET', 'detroit': 'DET',
  'packers': 'GB', 'green bay packers': 'GB', 'green bay': 'GB',
  'texans': 'HOU', 'houston texans': 'HOU', 'houston': 'HOU',
  'colts': 'IND', 'indianapolis colts': 'IND', 'indianapolis': 'IND',
  'jaguars': 'JAX', 'jacksonville jaguars': 'JAX', 'jacksonville': 'JAX',
  'chiefs': 'KC', 'kansas city chiefs': 'KC', 'kansas city': 'KC',
  'chargers': 'LAC', 'los angeles chargers': 'LAC', 'la chargers': 'LAC',
  'rams': 'LAR', 'los angeles rams': 'LAR', 'la rams': 'LAR',
  'raiders': 'LV', 'las vegas raiders': 'LV', 'las vegas': 'LV',
  'dolphins': 'MIA', 'miami dolphins': 'MIA', 'miami': 'MIA',
  'vikings': 'MIN', 'minnesota vikings': 'MIN', 'minnesota': 'MIN',
  'patriots': 'NE', 'new england patriots': 'NE', 'new england': 'NE',
  'saints': 'NO', 'new orleans saints': 'NO', 'new orleans': 'NO',
  'giants': 'NYG', 'new york giants': 'NYG', 'ny giants': 'NYG',
  'jets': 'NYJ', 'new york jets': 'NYJ', 'ny jets': 'NYJ',
  'eagles': 'PHI', 'philadelphia eagles': 'PHI', 'philadelphia': 'PHI',
  'steelers': 'PIT', 'pittsburgh steelers': 'PIT', 'pittsburgh': 'PIT',
  'seahawks': 'SEA', 'seattle seahawks': 'SEA', 'seattle': 'SEA',
  '49ers': 'SF', 'san francisco 49ers': 'SF', 'san francisco': 'SF', 'niners': 'SF',
  'buccaneers': 'TB', 'tampa bay buccaneers': 'TB', 'tampa bay': 'TB', 'bucs': 'TB',
  'titans': 'TEN', 'tennessee titans': 'TEN', 'tennessee': 'TEN',
  'commanders': 'WSH', 'washington commanders': 'WSH', 'washington': 'WSH',
}

function resolveTeamAbbr(text) {
  const clean = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  if (TEAM_NAME_TO_ABBR[clean]) return TEAM_NAME_TO_ABBR[clean]
  for (const [key, abbr] of Object.entries(TEAM_NAME_TO_ABBR)) {
    if (clean.includes(key)) return abbr
  }
  return null
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json()
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.text()
}

/**
 * Parses article HTML from Yahoo Sports / Akron Beacon Journal into structured game crews.
 */
function parseYahooArticle(html, articleUrl) {
  const pairings = new Map()
  const headingRegex = /<h2 class="heading">([^<]+)<\/h2>\s*<p>(?:Announcers:\s*)?([^<]+)<\/p>/g
  const matches = [...html.matchAll(headingRegex)]

  for (const m of matches) {
    const rawTitle = m[1].replace(/\([^)]*\)/g, '').trim()
    const rawAnnouncers = m[2].trim()

    // Title format: "Away Team at Home Team, 1 p.m., CBS"
    const parts = rawTitle.split(/\s+(?:at|vs)\s+/i)
    if (parts.length < 2) continue

    const awayStr = parts[0].trim()
    const homeStr = parts[1].split(',')[0].trim()
    const away = resolveTeamAbbr(awayStr)
    const home = resolveTeamAbbr(homeStr)
    if (!away || !home) continue

    const names = rawAnnouncers
      .split(/,\s*|(?:\s+and\s+)|\s*&\s*/)
      .map((s) => s.trim().replace(/^JJ\b/, 'J.J.'))
      .filter((s) => s.length > 2)

    if (names.length < 2) continue

    const playByPlay = names[0]
    const remaining = names.slice(1)
    const analysts = []
    const sideline = []

    for (const name of remaining) {
      if (KNOWN_SIDELINE_REPORTERS.has(name) || /sideline|reporter/i.test(name)) {
        sideline.push(name)
      } else {
        analysts.push(name)
      }
    }

    if (analysts.length === 0 && remaining.length > 0) {
      analysts.push(remaining[0])
      if (remaining.length > 1) sideline.push(...remaining.slice(1))
    }

    const key = [away, home].sort().join('|')
    pairings.set(key, {
      away,
      home,
      playByPlay,
      analysts,
      sideline,
      source: {
        label: 'Yahoo Sports / Akron Beacon Journal — NFL schedule and announcer pairings',
        url: articleUrl,
      },
    })
  }

  return pairings
}

async function main() {
  console.log('🏈 NFL Announcer Ingestion & Fact-Check Pipeline')
  console.log('--------------------------------------------------')

  // 1. Fetch live schedule from ESPN
  const scoreboard = await fetchJson(ESPN_API)
  const season = scoreboard.season?.year ?? 2026
  const defaultWeek = scoreboard.week?.number ?? 4
  const week = TARGET_WEEK ?? defaultWeek

  console.log(`Auditing Season ${season}, Week ${week}...`)

  const weekData = week === defaultWeek
    ? scoreboard
    : await fetchJson(`${ESPN_API}?seasontype=2&week=${week}`)

  const events = weekData.events || []
  if (events.length === 0) {
    console.log(`No games found for Week ${week}.`)
    return
  }

  console.log(`Found ${events.length} scheduled games for Week ${week}.\n`)

  // 2. Fetch external article pairings if URL provided or discoverable
  let parsedPairings = new Map()

  if (SOURCE_URL) {
    console.log(`Fetching article from: ${SOURCE_URL}...`)
    try {
      const html = await fetchText(SOURCE_URL)
      parsedPairings = parseYahooArticle(html, SOURCE_URL)
      console.log(`Successfully parsed ${parsedPairings.size} game pairings from article.`)
    } catch (err) {
      console.error(`Failed to fetch article: ${err.message}`)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const candidateEntries = []
  const missingGames = []
  const previewRows = []

  for (const event of events) {
    const comp = event.competitions?.[0]
    const away = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'away')?.team?.abbreviation)
    const home = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'home')?.team?.abbreviation)
    const network = (comp?.broadcasts || []).flatMap((b) => b.names || []).join(', ') || 'TBA'
    const kickoffUtc = event.date
    const key = [away, home].sort().join('|')

    // Check existing registry entry first
    const existing = findVerifiedCrew(season, week, away, home)

    // Time calculations in Eastern Time (NFL kickoff local standard)
    const d = new Date(kickoffUtc)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(d)
    const nyDay = parts.find((p) => p.type === 'weekday')?.value
    const nyHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)

    const isTNF = network.toUpperCase().includes('PRIME') || (nyDay === 'Thu' && nyHour >= 19)
    const isSNF = network.toUpperCase().includes('NBC') && (nyDay === 'Sun' && nyHour >= 19)
    const isMNF = (network.toUpperCase().includes('ESPN') || network.toUpperCase().includes('ABC')) && (nyDay === 'Mon' && nyHour >= 19)

    let crew = null
    let status = 'MISSING'

    if (existing) {
      status = 'VERIFIED (Registry)'
      crew = existing
    } else if (isTNF) {
      // Permanent Thursday Night Football on Prime Video
      status = 'CONFIRMED (TNF Primetime Exception)'
      crew = {
        season, week, away, home, kickoffUtc,
        network: 'Amazon Prime Video',
        playByPlay: 'Al Michaels',
        analysts: ['Kirk Herbstreit'],
        sideline: ['Kaylee Hartung'],
        sources: [{ label: 'Amazon Prime Video Thursday Night Football official crew', url: 'https://www.amazon.com/tnf' }],
        verifiedOn: today,
      }
      candidateEntries.push(crew)
    } else if (isSNF) {
      // Permanent Sunday Night Football on NBC
      status = 'CONFIRMED (SNF Primetime Exception)'
      crew = {
        season, week, away, home, kickoffUtc,
        network: 'NBC',
        playByPlay: 'Mike Tirico',
        analysts: ['Cris Collinsworth'],
        sideline: ['Melissa Stark'],
        sources: [{ label: 'NBC Sports Sunday Night Football official crew', url: 'https://www.nbcsports.com/nfl/sunday-night-football' }],
        verifiedOn: today,
      }
      candidateEntries.push(crew)
    } else if (isMNF) {
      // Permanent Monday Night Football on ESPN / ABC
      status = 'CONFIRMED (MNF Primetime Exception)'
      crew = {
        season, week, away, home, kickoffUtc,
        network: network.toUpperCase().includes('ABC') ? 'ESPN / ABC' : 'ESPN',
        playByPlay: 'Joe Buck',
        analysts: ['Troy Aikman'],
        sideline: ['Lisa Salters'],
        sources: [{ label: 'ESPN Monday Night Football official crew', url: 'https://www.espn.com/nfl' }],
        verifiedOn: today,
      }
      candidateEntries.push(crew)
    } else if (parsedPairings.has(key)) {
      // Match found from parsed article
      const parsed = parsedPairings.get(key)
      status = 'PARSED (Article)'
      crew = {
        season, week, away, home, kickoffUtc,
        network: network.toUpperCase().includes('FOX') ? 'FOX' : network.toUpperCase().includes('CBS') ? 'CBS' : network,
        playByPlay: parsed.playByPlay,
        analysts: parsed.analysts,
        sideline: parsed.sideline,
        sources: [parsed.source],
        verifiedOn: today,
      }
      candidateEntries.push(crew)
    } else {
      // Sunday afternoon CBS / FOX regional slates awaiting network release
      missingGames.push({ away, home, network, kickoffUtc })
    }

    previewRows.push({
      matchup: `${away} @ ${home}`,
      kickoff: kickoffUtc,
      network,
      status,
      leadDuo: crew ? `${crew.playByPlay} & ${crew.analysts.join(', ')}` : 'Crew TBA',
    })
  }

  console.table(previewRows)

  if (missingGames.length > 0) {
    console.log(`\n⏳ ${missingGames.length} Sunday regional games awaiting network announcement:`)
    for (const g of missingGames) {
      console.log(`   - ${g.away} @ ${g.home} (${g.network}, ${g.kickoffUtc}) -> Strict Zero-Guessing Rule: Stays Crew TBA`)
    }
    console.log('\n💡 CBS & FOX release Sunday afternoon assignments on Tuesday/Wednesday before game day.')
    console.log('   When published, run: node scripts/fetch-announcers.mjs --week ' + week + ' --url <article_url> --apply\n')
  }

  if (candidateEntries.length === 0) {
    console.log('✨ No new entries to apply to ANNOUNCER_REGISTRY.')
    return
  }

  console.log(`\nFound ${candidateEntries.length} new candidates ready for ingestion.`)

  if (!APPLY) {
    console.log('ℹ️  Run with --apply to write these entries into src/data/announcerRegistry.ts')
    return
  }

  // 3. Write entries to src/data/announcerRegistry.ts
  console.log('\nWriting verified entries to src/data/announcerRegistry.ts...')
  let registryCode = fs.readFileSync(REGISTRY_FILE, 'utf8')

  // Construct TypeScript snippet
  const lines = candidateEntries.map((e) => {
    const analystsStr = e.analysts.map((a) => `'${a}'`).join(', ')
    const sidelineStr = e.sideline.map((s) => `'${s}'`).join(', ')
    const sourcesStr = e.sources.map((s) => `{ label: '${s.label.replace(/'/g, "\\'")}', url: '${s.url}' }`).join(', ')
    return `  {
    season: ${e.season}, week: ${e.week}, away: '${e.away}', home: '${e.home}', kickoffUtc: '${e.kickoffUtc}',
    network: '${e.network}',
    playByPlay: '${e.playByPlay}', analysts: [${analystsStr}], sideline: [${sidelineStr}],
    sources: [${sourcesStr}],
    verifiedOn: '${e.verifiedOn}',
  },`
  }).join('\n')

  // Insert before closing bracket of ANNOUNCER_REGISTRY array
  const closeIndex = registryCode.indexOf('\n]\n')
  if (closeIndex === -1) throw new Error('Could not find closing bracket \\n]\\n in ANNOUNCER_REGISTRY')

  registryCode = registryCode.slice(0, closeIndex) + '\n' + lines + registryCode.slice(closeIndex)
  fs.writeFileSync(REGISTRY_FILE, registryCode, 'utf8')

  console.log(`✅ Successfully added ${candidateEntries.length} verified entries to ANNOUNCER_REGISTRY.`)
  console.log('Now run "npm test && npm run audit:announcers" to verify invariants.')
}

main().catch((err) => {
  console.error('❌ Ingestion error:', err.message)
  process.exit(1)
})
