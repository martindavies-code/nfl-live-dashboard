import test from 'node:test'
import assert from 'node:assert/strict'
import {
  POWER_RANKINGS_REGISTRY,
  NFL_TEAM_ABBREVIATIONS,
  normalizePowerRankingTeam,
  getLatestPowerRankingsEdition,
  getWeeklyPowerRankingsEdition,
  getAuthoritativePowerRankingsMap,
  getTeamPowerRank,
  getTeamPowerRankDetail,
  getPowerRankTierStyle,
  NFL_POWER_RANKINGS,
} from './powerRankingsRegistry.ts'

test('Power Rankings Registry: Ingestion and structure integrity', () => {
  assert.ok(Array.isArray(POWER_RANKINGS_REGISTRY), 'Registry should be an array')
  assert.ok(POWER_RANKINGS_REGISTRY.length >= 2, 'Should contain at least Week 9 and Week 8')

  const latest = getLatestPowerRankingsEdition()
  assert.equal(latest.week, 9)
  assert.equal(latest.season, 2026)
  assert.ok(latest.source.title.length > 0)
  assert.ok(latest.source.url.startsWith('https://'))
  assert.ok(latest.source.publisher.includes('Yahoo Sports'))

  // Verify all 32 franchises are accounted for in latest edition
  const abbreviations = Object.values(NFL_TEAM_ABBREVIATIONS)
  for (const abbr of abbreviations) {
    const entry = latest.rankings[abbr]
    assert.ok(entry, `Expected team ${abbr} to be ranked in Week 9 edition`)
    assert.ok(entry.rank >= 1 && entry.rank <= 32, `Rank for ${abbr} should be between 1 and 32`)
  }
})

test('Power Rankings Registry: normalizePowerRankingTeam handles aliases, casing, whitespace, and nullish inputs', () => {
  assert.equal(normalizePowerRankingTeam('kc'), 'KC')
  assert.equal(normalizePowerRankingTeam('  buf  '), 'BUF')
  assert.equal(normalizePowerRankingTeam('fne'), 'NE')
  assert.equal(normalizePowerRankingTeam('FNE'), 'NE')
  assert.equal(normalizePowerRankingTeam('NE'), 'NE')
  assert.equal(normalizePowerRankingTeam(null), '')
  assert.equal(normalizePowerRankingTeam(undefined), '')
  assert.equal(normalizePowerRankingTeam(''), '')
})

test('Power Rankings Registry: getWeeklyPowerRankingsEdition falls back cleanly on unknown week/season', () => {
  const w9 = getWeeklyPowerRankingsEdition(9, 2026)
  assert.equal(w9.week, 9)

  const w8 = getWeeklyPowerRankingsEdition(8, 2026)
  assert.equal(w8.week, 8)

  const fallback = getWeeklyPowerRankingsEdition(99, 1999)
  assert.equal(fallback.week, 9, 'Unknown week/season should fall back to latest edition')
})

test('Power Rankings Registry: getAuthoritativePowerRankingsMap generates complete map', () => {
  const map = getAuthoritativePowerRankingsMap(9)
  assert.equal(map.BUF, 1)
  assert.equal(map.SF, 2)
  assert.equal(map.IND, 32)
  assert.equal(Object.keys(map).length >= 32, true)

  // Backward compatibility object
  assert.equal(NFL_POWER_RANKINGS.BUF, 1)
})

test('Power Rankings Registry: getTeamPowerRank handles unranked teams and Patriots alias fallback', () => {
  assert.equal(getTeamPowerRank('NONEXISTENT'), 20)
  assert.equal(getTeamPowerRank(''), 20)
  assert.equal(getTeamPowerRank(undefined), 20)
  assert.equal(getTeamPowerRank('FNE'), 11)
  assert.equal(getTeamPowerRank('NE'), 11)
})

test('Power Rankings Registry: getTeamPowerRankDetail calculates change and handles missing entries', () => {
  const den = getTeamPowerRankDetail('DEN')
  assert.equal(den.rank, 5)
  assert.equal(den.change, 2)
  assert.ok(den.note?.includes('Week 8 statement'))

  const unk = getTeamPowerRankDetail('NONEXISTENT')
  assert.equal(unk.rank, 20)
  assert.equal(unk.change, 0)

  const fne = getTeamPowerRankDetail('FNE')
  assert.equal(fne.rank, 11)

  // Edge case: test with explicit week where change property is not present in entry (derives previousRank - rank or 0)
  const detW8 = getTeamPowerRankDetail('DET', 8)
  assert.equal(detW8.rank, 4)
  assert.equal(detW8.previousRank, 4)
  assert.equal(detW8.change, 0)
})

test('Power Rankings Registry: getPowerRankTierStyle returns proper tokens across all tiers', () => {
  assert.equal(getPowerRankTierStyle(3).tierLabel, 'Top 5 Elite')
  assert.equal(getPowerRankTierStyle(7).tierLabel, 'Top 10 Contender')
  assert.equal(getPowerRankTierStyle(12).tierLabel, 'Playoff Hunt')
  assert.equal(getPowerRankTierStyle(18).tierLabel, 'Mid Tier')
  assert.equal(getPowerRankTierStyle(29).tierLabel, 'Rebuilding')
})
