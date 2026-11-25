#!/usr/bin/env node
/**
 * Live announcer audit.
 *
 * Compares the fact-checked registry (src/data/announcerRegistry.ts) with ESPN's live schedule and
 * FAILS (exit 1) when:
 *   - a game kicking off within --within-hours (default 72) has no verified crew yet
 *   - a registry entry names a matchup that is not on ESPN's schedule for that week (typo / wrong week)
 *   - a registry entry's network disagrees with ESPN's listed network
 *   - a game's kickoff moved by > 30 min since the crew was verified (flex scheduling => re-verify)
 * Exits 2 if ESPN cannot be reached, so a scheduled run can never go green silently.
 *
 * Usage:
 *   npm run audit:announcers
 *   npm run audit:announcers -- --within-hours 72 --weeks 2 [--report-file out.json] [--update-report update.json]
 */
import fs from 'node:fs'
import { ANNOUNCER_REGISTRY, findVerifiedCrew, normalizeTeamAbbr } from '../src/data/announcerRegistry.ts'
import { resolveTargetWeeks } from './update-announcers.mjs'

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback
}
const WITHIN_HOURS = Number(argValue('--within-hours', 72))
const WEEKS_AHEAD = Math.max(1, Number(argValue('--weeks', 2)))
const REPORT_FILE = argValue('--report-file', null)
const UPDATE_REPORT_FILE = argValue('--update-report', null)
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
const KICKOFF_DRIFT_MS = 30 * 60 * 1000

const canonNetwork = (n) => {
  const u = String(n || '').toUpperCase()
  if (/PRIME|AMAZON/.test(u)) return 'PRIME'
  if (/ESPN|ABC/.test(u)) return 'ESPN'
  if (/NFL ?N/.test(u)) return 'NFLN'
  if (/NETFLIX/.test(u)) return 'NETFLIX'
  if (/PEACOCK/.test(u)) return 'PEACOCK'
  if (/YOUTUBE/.test(u)) return 'YOUTUBE'
  return u.replace(/[^A-Z]/g, '')
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

function summarise(event, season, week) {
  const comp = event.competitions?.[0]
  const away = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'away')?.team?.abbreviation)
  const home = normalizeTeamAbbr(comp?.competitors?.find((c) => c.homeAway === 'home')?.team?.abbreviation)
  const networks = (comp?.broadcasts || []).flatMap((b) => b.names || []).join(', ')
  return { season, week, away, home, kickoff: event.date, networks, name: event.shortName || `${away} @ ${home}` }
}

function loadUpdateReasons() {
  const map = new Map()
  if (!UPDATE_REPORT_FILE || !fs.existsSync(UPDATE_REPORT_FILE)) return map
  try {
    const data = JSON.parse(fs.readFileSync(UPDATE_REPORT_FILE, 'utf8'))
    for (const u of data.unmatched || []) {
      const key = `${u.season}|${u.week}|${[u.away, u.home].sort().join('|')}`
      map.set(key, { reason: u.reason, detail: u.detail })
    }
  } catch {
    /* ignore malformed update report */
  }
  return map
}

function writeAuditReport(payload) {
  if (!REPORT_FILE) return
  fs.writeFileSync(REPORT_FILE, JSON.stringify(payload, null, 2), 'utf8')
}

async function main() {
  const first = await fetchJson(BASE)
  const targetWeeks = resolveTargetWeeks(first, { weeks: WEEKS_AHEAD })
  const updateReasons = loadUpdateReasons()

  const games = []
  for (const target of targetWeeks) {
    const isDefault = target.seasonType === (first.season?.type ?? 2) && target.week === first.week?.number
    const data = isDefault ? first : await fetchJson(`${BASE}?seasontype=${target.seasonType}&week=${target.week}`)
    for (const e of data.events || []) games.push(summarise(e, target.season, target.week))
  }

  const now = Date.now()
  const errors = []
  const missingSoon = []
  const rows = []

  for (const g of games) {
    const entry = findVerifiedCrew(g.season, g.week, g.away, g.home)
    const hours = (Date.parse(g.kickoff) - now) / 3600000
    let status = 'verified'

    if (!entry) {
      status = hours < -4 ? 'played (no crew recorded)' : 'MISSING'
      if (hours >= -4 && hours <= WITHIN_HOURS) {
        const key = `${g.season}|${g.week}|${[g.away, g.home].sort().join('|')}`
        const updateInfo = updateReasons.get(key)
        missingSoon.push({
          ...g,
          hours,
          reason: updateInfo?.reason || 'no verified crew in registry',
          detail: updateInfo?.detail || '',
        })
      }
    } else {
      if (g.networks && canonNetwork(entry.network) !== canonNetwork(g.networks)) {
        status = 'NETWORK MISMATCH'
        errors.push(`${g.name} (W${g.week}): registry says "${entry.network}" but ESPN lists "${g.networks}"`)
      }
      const drift = Math.abs(Date.parse(entry.kickoffUtc) - Date.parse(g.kickoff))
      if (drift > KICKOFF_DRIFT_MS) {
        status = 'KICKOFF MOVED'
        errors.push(
          `${g.name} (W${g.week}): kickoff moved ${entry.kickoffUtc} -> ${g.kickoff}; re-verify the crew and update kickoffUtc/verifiedOn`
        )
      }
    }
    rows.push({ game: `W${g.week} ${g.away}@${g.home}`, kickoff: g.kickoff, network: g.networks || '-', crew: status })
  }

  // Registry entries in the audited weeks that ESPN doesn't recognise
  const scheduled = new Set(games.map((g) => `${g.season}|${g.week}|${[g.away, g.home].sort().join('|')}`))
  const auditedWeeks = new Set(games.map((g) => `${g.season}|${g.week}`))
  for (const e of ANNOUNCER_REGISTRY) {
    if (!auditedWeeks.has(`${e.season}|${e.week}`)) continue
    if (!scheduled.has(`${e.season}|${e.week}|${[e.away, e.home].sort().join('|')}`)) {
      errors.push(`Registry entry ${e.season} W${e.week} ${e.away}@${e.home} is not on ESPN's schedule — wrong teams or week?`)
    }
  }

  console.table(rows)

  for (const m of missingSoon) {
    const why = m.detail ? `${m.reason} (${m.detail})` : m.reason
    errors.push(
      `No verified announcers for ${m.name} (W${m.week}) — kicks off ${m.hours < 0 ? 'now/started' : `in ${m.hours.toFixed(1)}h`} — reason: ${why}.`
    )
  }

  if (errors.length) {
    writeAuditReport({
      status: 'fail',
      generatedAt: new Date().toISOString(),
      withinHours: WITHIN_HOURS,
      missingSoon,
      errors,
    })
    console.error(`\n❌ Announcer audit failed (${errors.length}):`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exitCode = 1
    return
  }

  writeAuditReport({
    status: 'pass',
    generatedAt: new Date().toISOString(),
    withinHours: WITHIN_HOURS,
    missingSoon: [],
    errors: [],
  })
  console.log(`\n✅ Announcer audit passed: every game within ${WITHIN_HOURS}h has a verified crew.`)
}

main().catch((err) => {
  writeAuditReport({
    status: 'error',
    generatedAt: new Date().toISOString(),
    withinHours: WITHIN_HOURS,
    missingSoon: [],
    errors: [`Announcer audit could not run: ${err.message}`],
  })
  console.error('❌ Announcer audit could not run:', err.message)
  process.exitCode = 2
})
