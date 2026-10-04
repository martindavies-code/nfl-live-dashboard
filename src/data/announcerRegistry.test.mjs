import test from 'node:test'
import assert from 'node:assert/strict'
import { ANNOUNCER_REGISTRY, findVerifiedCrew, normalizeTeamAbbr } from './announcerRegistry.ts'

// ESPN scoreboard abbreviations
const TEAMS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WSH',
])

const NETWORKS = new Set([
  'CBS', 'FOX', 'NBC', 'ESPN / ABC', 'ESPN', 'ABC', 'Amazon Prime Video', 'NFL Network', 'Netflix', 'Peacock', 'YouTube',
])

const GAME_DURATION_MS = 3 * 60 * 60 * 1000
const NAME_RE = /^[A-Z][A-Za-z.'’-]*(?: [A-Z][A-Za-z.'’-]*)+$/
const pair = (g) => [g.away, g.home].sort().join('|')
const label = (g) => `${g.season} W${g.week} ${g.away}@${g.home}`
const people = (g) => [g.playByPlay, ...g.analysts, ...g.sideline]

test('Announcer registry is not empty', () => {
  assert.ok(ANNOUNCER_REGISTRY.length > 0)
})

test('Announcer registry: every entry is well-formed and fully sourced', () => {
  const today = new Date().toISOString().slice(0, 10)
  for (const g of ANNOUNCER_REGISTRY) {
    const l = label(g)
    assert.ok(Number.isInteger(g.season) && g.season >= 2025 && g.season <= 2040, `${l}: season`)
    assert.ok(Number.isInteger(g.week) && g.week >= 1 && g.week <= 22, `${l}: week`)
    assert.ok(TEAMS.has(g.away), `${l}: unknown away team (use ESPN abbreviations; Patriots are NE)`)
    assert.ok(TEAMS.has(g.home), `${l}: unknown home team`)
    assert.notEqual(g.away, g.home, `${l}: team cannot play itself`)
    assert.ok(!Number.isNaN(Date.parse(g.kickoffUtc)) && g.kickoffUtc.endsWith('Z'), `${l}: kickoffUtc must be ISO UTC`)
    assert.ok(NETWORKS.has(g.network), `${l}: unrecognised network "${g.network}"`)

    for (const n of people(g)) {
      assert.ok(NAME_RE.test(n), `${l}: "${n}" does not look like a real full name (placeholder/typo?)`)
      assert.ok(!/\b(tba|tbd|unknown|n\/a)\b/i.test(n), `${l}: placeholder name "${n}"`)
    }
    assert.ok(g.analysts.length >= 1, `${l}: needs at least one analyst`)
    assert.equal(new Set(people(g)).size, people(g).length, `${l}: a person is listed twice in one crew`)

    assert.ok(g.sources.length >= 1, `${l}: needs at least one source`)
    for (const s of g.sources) {
      assert.ok(s.label.trim().length > 0, `${l}: source label`)
      assert.equal(new URL(s.url).protocol, 'https:', `${l}: source must be an https URL`)
    }
    assert.match(g.verifiedOn, /^\d{4}-\d{2}-\d{2}$/, `${l}: verifiedOn must be YYYY-MM-DD`)
    assert.ok(g.verifiedOn <= today, `${l}: verifiedOn is in the future`)
  }
})

test('Announcer registry: no duplicate games, and no team plays twice in one week', () => {
  const games = new Set()
  const teamWeeks = new Set()
  for (const g of ANNOUNCER_REGISTRY) {
    const key = `${g.season}|${g.week}|${pair(g)}`
    assert.ok(!games.has(key), `${label(g)}: duplicate entry`)
    games.add(key)
    for (const t of [g.away, g.home]) {
      const tw = `${g.season}|${g.week}|${t}`
      assert.ok(!teamWeeks.has(tw), `${label(g)}: ${t} already has a game in this week`)
      teamWeeks.add(tw)
    }
  }
})

test('Announcer registry: nobody is booked in two games that overlap in time', () => {
  for (let i = 0; i < ANNOUNCER_REGISTRY.length; i++) {
    for (let j = i + 1; j < ANNOUNCER_REGISTRY.length; j++) {
      const a = ANNOUNCER_REGISTRY[i]
      const b = ANNOUNCER_REGISTRY[j]
      const gap = Math.abs(Date.parse(a.kickoffUtc) - Date.parse(b.kickoffUtc))
      if (gap >= GAME_DURATION_MS) continue
      const shared = people(a).filter((n) => people(b).includes(n))
      assert.deepEqual(
        shared,
        [],
        `${shared.join(', ')} cannot call both ${label(a)} and ${label(b)} (kickoffs ${gap / 60000} min apart) — one entry is wrong`
      )
    }
  }
})

test('Announcer registry: lookup helpers are strict and normalise team codes', () => {
  assert.equal(normalizeTeamAbbr('fne'), 'NE')
  assert.equal(normalizeTeamAbbr('WAS'), 'WSH')
  assert.ok(findVerifiedCrew(2026, 4, 'FNE', 'BUF'))
  assert.ok(findVerifiedCrew(2026, 4, 'BUF', 'NE'))
  assert.equal(findVerifiedCrew(2026, 5, 'NE', 'BUF'), undefined)
  assert.equal(findVerifiedCrew(undefined, 4, 'NE', 'BUF'), undefined)
  assert.equal(findVerifiedCrew(2026, undefined, 'NE', 'BUF'), undefined)
  assert.equal(findVerifiedCrew(2026, 4, '', ''), undefined)
})
