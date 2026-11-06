#!/usr/bin/env node
/**
 * Automated script to search and update official NFL YouTube highlights
 * in src/data/highlightsRegistry.ts across all past and completed weeks.
 *
 * Scrapes official @nfl channel search results for completed games with
 * high-precision title verification matching teams, year, and week numbers.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REGISTRY_FILE = path.resolve(__dirname, '../src/data/highlightsRegistry.ts')

async function fetchScoreboard(year = 2026, week = 8, seasonType = 2) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=${seasonType}&week=${week}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`ESPN API returned ${res.status}`)
  return await res.json()
}

function matchTeam(text, team) {
  if (!team) return false
  const clean = text.toLowerCase()
  const name = (team.name || '').toLowerCase()
  const disp = (team.displayName || '').toLowerCase()
  const stem = name.endsWith('s') ? name.slice(0, -1) : name
  return clean.includes(name) || clean.includes(disp) || (stem.length > 3 && clean.includes(stem))
}

function matchHighlight(title, awayTeam, homeTeam, week, _year) {
  const text = title.toLowerCase()
  if (!text.includes('highlight')) return false
  if (!matchTeam(text, awayTeam)) return false
  if (!matchTeam(text, homeTeam)) return false

  // Reject any past seasons (2010-2025)
  if (/\b(201\d|202[0-5])\b/.test(text)) return false

  // Strict Week check: \bweek\s*X\b
  const hasTargetWeek = new RegExp(`\\bweek\\s*${week}\\b`, 'i').test(text)
  if (hasTargetWeek) return true

  // Fallback check: if no other week number is mentioned anywhere in the title (e.g. Melbourne international game or shortened titles)
  const mentionsOtherWeek = /\bweek\s*\d+\b/i.test(text)
  if (!mentionsOtherWeek) {
    return true
  }

  return false
}

async function findYouTubeHighlight(awayTeam, homeTeam, week, year, retries = 2) {
  const q = `${awayTeam.displayName} vs ${homeTeam.displayName} Game Highlights ${year} Week ${week}`
  const url = `https://www.youtube.com/@nfl/search?query=${encodeURIComponent(q)}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      })
      if (!res.ok) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
          continue
        }
        return null
      }
      const html = await res.text()
      const jsonStr = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s)?.[1] || ''
      const titles = [
        ...jsonStr.matchAll(
          /"videoRenderer":\{"videoId":"([^"]+)".+?"title":\{"runs":\[\{"text":"([^"]+)"/g
        ),
      ]

      if (titles.length === 0 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
        continue
      }

      const match = titles.find((t) => matchHighlight(t[2], awayTeam, homeTeam, week, year))
      if (match) {
        return {
          videoId: match[1],
          title: match[2].trim(),
        }
      }

      return null
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
        continue
      }
      console.warn(`Failed searching YouTube for ${awayTeam.displayName} vs ${homeTeam.displayName}:`, err.message)
      return null
    }
  }
  return null
}

async function pMap(items, fn, concurrency = 3) {
  const results = new Array(items.length)
  let currentIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const i = currentIndex++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

async function currentWeek(year, seasonType) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=${seasonType}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`ESPN API returned ${res.status}`)
  const data = await res.json()
  return data?.week?.number || 1
}

async function main() {
  const year = 2026
  const seasonType = 2
  const targetWeekArg = process.argv.find((a) => a.startsWith('--week='))

  const weeksToScan = targetWeekArg
    ? [parseInt(targetWeekArg.split('=')[1], 10)]
    : Array.from({ length: await currentWeek(year, seasonType) }, (_, i) => i + 1)

  console.log(`[Highlights Ingestion] Scanning official highlights for ${year} weeks:`, weeksToScan)

  const allEntriesByWeek = {}

  for (const week of weeksToScan) {
    console.log(`\n--- Fetching ESPN scoreboard for Week ${week} ---`)
    const sbData = await fetchScoreboard(year, week, seasonType)
    const events = sbData.events || []
    allEntriesByWeek[week] = []

    const finishedGames = []
    for (const ev of events) {
      const comp = ev.competitions?.[0]
      const state = ev.status?.type?.state || comp?.status?.type?.state
      if (state !== 'post') continue // Only finished games

      const awayComp = comp?.competitors?.find((c) => c.homeAway === 'away')
      const homeComp = comp?.competitors?.find((c) => c.homeAway === 'home')
      const awayTeam = awayComp?.team
      const homeTeam = homeComp?.team
      const awayAbbr = awayTeam?.abbreviation
      const homeAbbr = homeTeam?.abbreviation

      const typeStr = seasonType === 3 ? 'POST' : 'REG'
      const key = `${year}_${typeStr}_${week}_${awayAbbr}_${homeAbbr}`

      finishedGames.push({
        key,
        awayTeam,
        homeTeam,
        kickoffUtc: comp?.date || ev.date || '',
        week,
      })
    }

    console.log(`Week ${week}: ${finishedGames.length} completed games. Resolving official highlights...`)

    await pMap(
      finishedGames,
      async (game) => {
        const result = await findYouTubeHighlight(game.awayTeam, game.homeTeam, week, year)
        if (result && result.videoId) {
          console.log(`  ✓ [Matched] ${game.key} -> ${result.videoId} ("${result.title}")`)
          allEntriesByWeek[week].push({
            key: game.key,
            videoId: result.videoId,
            title: result.title,
            kickoffUtc: game.kickoffUtc,
          })
        } else {
          console.warn(`  ✗ [Missing] ${game.key} (${game.awayTeam?.name} @ ${game.homeTeam?.name})`)
        }
      },
      3
    )
  }

  // Merge with the existing registry: a fresh verified match overwrites the same
  // key, but previously verified entries are never deleted, and weeks that were
  // not scanned (or whose scrape failed) are preserved as-is.
  let existing = {}
  try {
    const srcText = fs.readFileSync(REGISTRY_FILE, 'utf8')
    const entryRe =
      /'([^']+)':\s*\{\s*videoId:\s*'([^']+)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*kickoffUtc:\s*'([^']*)',?\s*\}/g
    let m
    while ((m = entryRe.exec(srcText))) {
      existing[m[1]] = { videoId: m[2], title: m[3].replace(/\\'/g, "'"), kickoffUtc: m[4] }
    }
  } catch {
    existing = {}
  }

  const merged = { ...existing }
  for (const wk of Object.keys(allEntriesByWeek)) {
    for (const item of allEntriesByWeek[wk]) {
      merged[item.key] = { videoId: item.videoId, title: item.title, kickoffUtc: item.kickoffUtc }
    }
  }

  const byWeek = {}
  for (const [key, val] of Object.entries(merged)) {
    const wk = parseInt(key.split('_')[2], 10)
    if (!Number.isFinite(wk)) continue
    ;(byWeek[wk] = byWeek[wk] || []).push({ key, ...val })
  }

  // Generate updated TypeScript registry file
  let code = `import { sanitizePatriotsAbbreviation } from '../utils/nflHelpers.ts'

export interface RegisteredHighlight {
  videoId: string
  title: string
  kickoffUtc?: string
}

/**
 * Authoritative registry of official NFL YouTube game highlight videos.
 * Published directly by the official NFL YouTube channel (@nfl).
 *
 * Key format: \`\${seasonYear}_\${seasonType}_\${weekNumber}_\${awayAbbr}_\${homeAbbr}\`
 * where seasonType is 'REG' or 'POST'.
 */
export const HIGHLIGHTS_REGISTRY: Record<string, RegisteredHighlight> = {
`

  let totalEntries = 0
  const sortedWeeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b)
  for (const week of sortedWeeks) {
    const list = byWeek[week]
    if (!list || list.length === 0) continue
    // Sort games chronologically by kickoffUtc
    list.sort((a, b) => (a.kickoffUtc || '').localeCompare(b.kickoffUtc || ''))

    code += `  // =========================================================================\n`
    code += `  // ${year} Regular Season - Week ${week} (${list.length} Official NFL Highlights)\n`
    code += `  // =========================================================================\n`
    for (const item of list) {
      code += `  '${item.key}': {\n`
      code += `    videoId: '${item.videoId}',\n`
      code += `    title: '${item.title.replace(/'/g, "\\'")}',\n`
      code += `    kickoffUtc: '${item.kickoffUtc}',\n`
      code += `  },\n`
      totalEntries++
    }
    code += `\n`
  }

  code += `}

/**
 * Normalizes team abbreviation for registry key lookup.
 * Automatically handles Patriots aliases (FNE -> NE) and upper-casing.
 */
export function normalizeHighlightAbbr(abbr?: string | null): string {
  if (!abbr || typeof abbr !== 'string') return ''
  const clean = abbr.trim().toUpperCase()
  if (clean === 'FNE' || clean === 'PATRIOTS') return 'NE'
  const sanitized = sanitizePatriotsAbbreviation(clean)
  if (sanitized === 'FNE') return 'NE'
  return clean
}

/**
 * Builds the canonical registry key for a given game.
 */
export function buildHighlightKey(
  seasonYear?: number | string | null,
  seasonType?: number | string | null,
  weekNumber?: number | string | null,
  awayAbbr: string = '',
  homeAbbr: string = ''
): string {
  const year = seasonYear ? String(seasonYear).trim() : '2026'
  const typeStr = Number(seasonType) === 3 ? 'POST' : 'REG'
  const week = weekNumber ? String(weekNumber).trim() : '1'
  const away = normalizeHighlightAbbr(awayAbbr)
  const home = normalizeHighlightAbbr(homeAbbr)
  return \`\${year}_\${typeStr}_\${week}_\${away}_\${home}\`
}

/**
 * Looks up a registered official highlight video for a game.
 */
export function getRegisteredHighlight(
  seasonYear?: number | string | null,
  seasonType?: number | string | null,
  weekNumber?: number | string | null,
  awayAbbr?: string | null,
  homeAbbr?: string | null
): RegisteredHighlight | null {
  if (!awayAbbr || !homeAbbr) return null
  const key = buildHighlightKey(
    seasonYear ?? 2026,
    seasonType ?? 2,
    weekNumber ?? 1,
    awayAbbr,
    homeAbbr
  )
  return HIGHLIGHTS_REGISTRY[key] || null
}
`

  fs.writeFileSync(REGISTRY_FILE, code, 'utf8')
  console.log(`\n🎉 Successfully wrote ${totalEntries} official NFL highlights into ${REGISTRY_FILE}!`)
}

main().catch((err) => {
  console.error('Fatal error updating highlights:', err)
  process.exit(1)
})
