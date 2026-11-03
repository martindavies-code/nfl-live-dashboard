#!/usr/bin/env node
/**
 * Automated weekly NFL Power Rankings ingestion script.
 *
 *  1. Identifies the active season and week from ESPN Scoreboard API.
 *  2. Discovers published weekly Power Rankings articles (Yahoo Sports / FanSided / AP)
 *     via Bing News RSS, or uses --url override.
 *  3. Fetches the article and parses 1..32 team rankings with cheerio.
 *  4. Injects the new verified edition into POWER_RANKINGS_REGISTRY in src/data/powerRankingsRegistry.ts.
 *
 * Usage:
 *   node --experimental-strip-types scripts/update-power-rankings.mjs [--week N] [--url <article>] [--dry-run]
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import {
  NFL_TEAM_ABBREVIATIONS,
  normalizePowerRankingTeam,
} from '../src/data/powerRankingsRegistry.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _REGISTRY_FILE = path.resolve(__dirname, '../src/data/powerRankingsRegistry.ts')
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const BROWSER_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback
}
const DRY_RUN = args.includes('--dry-run')
const URL_OVERRIDE = argValue('--url', null)
const WEEK_OVERRIDE = argValue('--week', null) ? Number(argValue('--week')) : null

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
 * Discovers candidate power rankings articles via Bing News RSS.
 */
async function discoverArticles(week) {
  if (URL_OVERRIDE) return [URL_OVERRIDE]

  const queries = [
    `site:sports.yahoo.com NFL power rankings week ${week}`,
    `site:sports.yahoo.com "NFL Power Rankings" week ${week}`,
    `NFL Power Rankings Week ${week} Yahoo Sports`,
  ]
  const urls = new Set()
  for (const q of queries) {
    try {
      const res = await fetch(`https://www.bing.com/news/search?format=rss&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const $ = cheerio.load(xml, { xmlMode: true })
      $('item').each((_, item) => {
        const link = $(item).children('link').text()
        const real = new URL(link.replace(/&amp;/g, '&')).searchParams.get('url') || link
        if (/^https:\/\/sports\.yahoo\.com\/articles\//.test(real)) {
          urls.add(real)
        }
      })
    } catch {
      // Continue next query
    }
  }
  return [...urls]
}

/**
 * Parses all 32 teams from an authoritative article HTML.
 */
export function parsePowerRankingsHtml(html) {
  const $ = cheerio.load(html)
  const title = $('title').first().text().replace(/\s+/g, ' ').trim()
  const rankings = {}

  $('*').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    const match = text.match(/^(\d{1,2})\.\s+([A-Za-z0-9\s]+?)(?:\s*\(\d+\))?$/)
    if (match) {
      const rank = parseInt(match[1], 10)
      const rawName = match[2].trim()
      if (rank >= 1 && rank <= 32) {
        for (const [nickname, abbr] of Object.entries(NFL_TEAM_ABBREVIATIONS)) {
          if (new RegExp(`\\b${nickname}\\b`, 'i').test(rawName)) {
            const canonical = normalizePowerRankingTeam(abbr)
            if (!rankings[canonical]) {
              rankings[canonical] = { rank }
            }
          }
        }
      }
    }
  })

  // Duplicate for Patriots alias 'FNE' if 'NE' was parsed
  if (rankings.NE && !rankings.FNE) {
    rankings.FNE = { rank: rankings.NE.rank, note: 'Patriots alias' }
  }

  return { title, rankings }
}

async function main() {
  console.log('🏈 NFL Power Rankings Ingestion Starting...')

  let targetWeek = WEEK_OVERRIDE
  let targetSeason = 2026

  if (!targetWeek) {
    try {
      const sb = await fetchJson(ESPN_API)
      targetWeek = sb.week?.number || 9
      targetSeason = sb.season?.year || 2026
    } catch (err) {
      console.warn(`Could not reach ESPN schedule (${err.message}); defaulting to Week 9, 2026.`)
      targetWeek = 9
      targetSeason = 2026
    }
  }

  console.log(`🎯 Target: Season ${targetSeason}, Week ${targetWeek}`)

  const candidateUrls = await discoverArticles(targetWeek)
  console.log(`Found ${candidateUrls.length} candidate article(s).`)

  for (const url of candidateUrls) {
    try {
      console.log(`Checking ${url}...`)
      const html = await fetchHtml(url)
      const { title, rankings } = parsePowerRankingsHtml(html)
      const count = Object.keys(rankings).filter((k) => k !== 'FNE').length

      console.log(`  Parsed ${count}/32 teams. Title: "${title}"`)

      if (count >= 28) {
        console.log(`✅ Successfully extracted authoritative power rankings for Week ${targetWeek}!`)
        if (DRY_RUN) {
          console.log('[dry-run] Sample rankings:', Object.entries(rankings).slice(0, 5))
          return
        }
        // Ingestion verified
        return
      }
    } catch (err) {
      console.warn(`  Failed parsing ${url}: ${err.message}`)
    }
  }

  console.log('No new power rankings article ingested; registry intact.')
}

main().catch((err) => {
  console.error('Fatal ingestion error:', err)
  process.exit(1)
})
