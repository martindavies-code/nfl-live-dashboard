#!/usr/bin/env node
/**
 * Live announcer audit.
 *
 * Compares the fact-checked registry (src/data/announcerRegistry.ts) with ESPN's live schedule and
 * FAILS (exit 1) when:
 *   - a game kicking off within --within-hours (default 48) has no verified crew yet
 *   - a registry entry names a matchup that is not on ESPN's schedule for that week (typo / wrong week)
 *   - a registry entry's network disagrees with ESPN's listed network
 *   - a game's kickoff moved by > 30 min since the crew was verified (flex scheduling => re-verify)
 * Exits 2 if ESPN cannot be reached, so a scheduled run can never go green silently.
 *
 * Usage:
 *   npm run audit:announcers
 *   npm run audit:announcers -- --within-hours 72 --weeks 3
 */
import { ANNOUNCER_REGISTRY, findVerifiedCrew, normalizeTeamAbbr } from '../src/data/announcerRegistry.ts'

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : fallback
}
const WITHIN_HOURS = argValue('--within-hours', 48)
const WEEKS_AHEAD = Math.max(1, argValue('--weeks', 2))
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
const KICKOFF_DRIFT_MS = 30 * 60 * 1000

const canonNetwork = (n) => {
  const u = String(n || '').toUpperCase()
  if (/PRIME|AMAZON/.test(u)) return 'PRIME'
  if (/ESPN|ABC/.test(u)) return 'ESPN'
  if (/NFL ?N/.test(u)) return 'NFLN'
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

async function main() {
  const first = await fetchJson(BASE)
  const season = first.season?.year
  const seasonType = first.season?.type ?? 2
  const startWeek = first.week?.number
  if (!season || !startWeek) throw new Error('ESPN response is missing season/week')

  const games = []
  for (let i = 0; i < WEEKS_AHEAD; i++) {
    const week = startWeek + i
    const data = i === 0 ? first : await fetchJson(`${BASE}?seasontype=${seasonType}&week=${week}`)
    for (const e of data.events || []) games.push(summarise(e, season, week))
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
      if (hours >= -4 && hours <= WITHIN_HOURS) missingSoon.push({ ...g, hours })
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
    errors.push(
      `No verified announcers for ${m.name} (W${m.week}) — kicks off ${m.hours < 0 ? 'now/started' : `in ${m.hours.toFixed(1)}h`}. ` +
        'Look up the published pairing and add it to src/data/announcerRegistry.ts.'
    )
  }

  if (errors.length) {
    console.error(`\n❌ Announcer audit failed (${errors.length}):`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exitCode = 1
    return
  }
  console.log(`\n✅ Announcer audit passed: every game within ${WITHIN_HOURS}h has a verified crew.`)
}

main().catch((err) => {
  console.error('❌ Announcer audit could not run:', err.message)
  process.exitCode = 2
})
