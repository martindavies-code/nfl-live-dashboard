#!/usr/bin/env node
/**
 * Automated script to search and update official NFL YouTube highlights
 * in src/data/highlightsRegistry.ts.
 *
 * Scrapes official @nfl channel search results for completed games.
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

async function findYouTubeHighlight(awayName, homeName, week, year, seasonType) {
  const seasonTypeLabel = seasonType === 3 ? 'Playoffs' : 'Season'
  const q = `${awayName} vs ${homeName} Game Highlights ${year} NFL ${seasonTypeLabel} Week ${week}`
  const url = `https://www.youtube.com/@nfl/search?query=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/)
    if (!match) return null

    const videoId = match[1]
    // Fetch video page to verify exact title from the official NFL channel
    const vidRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const vidHtml = await vidRes.text()
    const titleMatch = vidHtml.match(/<title>(.*?)<\/title>/)
    let title = titleMatch ? titleMatch[1].replace(/ - YouTube$/, '').trim() : `${awayName} vs ${homeName} Game Highlights`

    return { videoId, title }
  } catch (err) {
    console.warn(`Failed searching YouTube for ${awayName} vs ${homeName}:`, err.message)
    return null
  }
}

async function main() {
  const year = 2026
  const week = 8
  const seasonType = 2

  console.log(`[Highlights Ingestion] Fetching ESPN scoreboard for ${year} Season Week ${week}...`)
  const sbData = await fetchScoreboard(year, week, seasonType)
  const events = sbData.events || []

  console.log(`Found ${events.length} games. Scanning for completed games...`)

  let registryCode = fs.readFileSync(REGISTRY_FILE, 'utf8')
  let countUpdated = 0

  for (const ev of events) {
    const comp = ev.competitions?.[0]
    const state = ev.status?.type?.state || comp?.status?.type?.state
    if (state !== 'post') continue // Only finished games

    const awayComp = comp?.competitors?.find((c) => c.homeAway === 'away')
    const homeComp = comp?.competitors?.find((c) => c.homeAway === 'home')
    const awayAbbr = awayComp?.team?.abbreviation
    const homeAbbr = homeComp?.team?.abbreviation
    const awayName = awayComp?.team?.displayName || awayComp?.team?.name
    const homeName = homeComp?.team?.displayName || homeComp?.team?.name

    const typeStr = seasonType === 3 ? 'POST' : 'REG'
    const key = `${year}_${typeStr}_${week}_${awayAbbr}_${homeAbbr}`

    if (registryCode.includes(`'${key}':`)) {
      console.log(`  ✓ ${key} already registered.`)
      continue
    }

    console.log(`  🔍 Searching official highlights for ${key} (${awayName} @ ${homeName})...`)
    const result = await findYouTubeHighlight(awayName, homeName, week, year, seasonType)
    if (result && result.videoId) {
      console.log(`  ✅ Found ${result.videoId}: "${result.title}"`)
      const entryBlock = `  '${key}': {\n    videoId: '${result.videoId}',\n    title: '${result.title.replace(/'/g, "\\'")}',\n    kickoffUtc: '${comp?.date || ev.date || ''}',\n  },\n`
      // Insert into HIGHLIGHTS_REGISTRY
      const targetPos = registryCode.indexOf('};\n')
      if (targetPos !== -1) {
        registryCode = registryCode.slice(0, targetPos) + entryBlock + registryCode.slice(targetPos)
        countUpdated++
      }
    }
  }

  if (countUpdated > 0) {
    fs.writeFileSync(REGISTRY_FILE, registryCode, 'utf8')
    console.log(`Successfully injected ${countUpdated} new official NFL highlight entries!`)
  } else {
    console.log(`All completed games already up to date.`)
  }
}

main().catch((err) => {
  console.error('Fatal error updating highlights:', err)
  process.exit(1)
})
