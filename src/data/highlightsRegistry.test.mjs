import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HIGHLIGHTS_REGISTRY,
  normalizeHighlightAbbr,
  buildHighlightKey,
  getRegisteredHighlight,
} from './highlightsRegistry.ts'

test('Highlights Registry: all entries have valid 11-char YouTube video IDs and non-empty titles', () => {
  const entries = Object.entries(HIGHLIGHTS_REGISTRY)
  assert.ok(entries.length >= 14, `Expected at least 14 registered highlights, got ${entries.length}`)

  const youtubeVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/

  for (const [key, item] of entries) {
    assert.match(
      item.videoId,
      youtubeVideoIdRegex,
      `Key ${key} has an invalid YouTube video ID: "${item.videoId}"`
    )
    assert.ok(
      typeof item.title === 'string' && item.title.trim().length > 10,
      `Key ${key} has an invalid title: "${item.title}"`
    )
    assert.ok(
      item.title.toLowerCase().includes('highlights'),
      `Key ${key} title should mention Highlights: "${item.title}"`
    )
  }
})

test('Highlights Registry: normalizeHighlightAbbr normalizes casing, whitespace, and Patriots aliases', () => {
  assert.equal(normalizeHighlightAbbr(null), '')
  assert.equal(normalizeHighlightAbbr(undefined), '')
  assert.equal(normalizeHighlightAbbr(''), '')
  assert.equal(normalizeHighlightAbbr('chi'), 'CHI')
  assert.equal(normalizeHighlightAbbr('  det  '), 'DET')
  assert.equal(normalizeHighlightAbbr('fne'), 'NE')
  assert.equal(normalizeHighlightAbbr('FNE'), 'NE')
  assert.equal(normalizeHighlightAbbr('PATRIOTS'), 'NE')
  assert.equal(normalizeHighlightAbbr('GB'), 'GB')
})

test('Highlights Registry: buildHighlightKey generates canonical keys for REG and POST seasons', () => {
  assert.equal(
    buildHighlightKey(2026, 2, 8, 'CHI', 'SEA'),
    '2026_REG_8_CHI_SEA'
  )
  assert.equal(
    buildHighlightKey(2026, 3, 1, 'KC', 'BAL'),
    '2026_POST_1_KC_BAL'
  )
  assert.equal(
    buildHighlightKey(2026, 2, 8, 'FNE', 'MIA'),
    '2026_REG_8_NE_MIA'
  )
  // Fallbacks
  assert.equal(
    buildHighlightKey(null, null, null, 'car', 'gb'),
    '2026_REG_1_CAR_GB'
  )
})

test('Highlights Registry: getRegisteredHighlight resolves exact matchups and handles missing entries', () => {
  // 1. User reference game: Chicago Bears vs Seattle Seahawks Week 8
  const bearsSeahawks = getRegisteredHighlight(2026, 2, 8, 'CHI', 'SEA')
  assert.ok(bearsSeahawks)
  assert.equal(bearsSeahawks.videoId, 'j8XRNpYOsos')
  assert.ok(bearsSeahawks.title.includes('Chicago Bears vs Seattle Seahawks'))

  // 2. Patriots alias lookup (FNE -> NE)
  const patsDolphins = getRegisteredHighlight(2026, 2, 8, 'FNE', 'MIA')
  assert.ok(patsDolphins)
  assert.equal(patsDolphins.videoId, 'EL_8uTSc1PY')

  // 3. Missing/Unindexed game returns null
  assert.equal(getRegisteredHighlight(2026, 2, 99, 'XYZ', 'ABC'), null)
  assert.equal(getRegisteredHighlight(2026, 2, 8, null, 'SEA'), null)
  assert.equal(getRegisteredHighlight(2026, 2, 8, 'CHI', null), null)

  // 4. Nullish season/week parameters use default fallback
  assert.equal(getRegisteredHighlight(null, null, null, 'CHI', 'SEA'), null)
  assert.equal(normalizeHighlightAbbr(123), '')
})
