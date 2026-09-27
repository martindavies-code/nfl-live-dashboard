import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNFLEvent, sanitizeUrl, FALLBACK_LOGO } from './normalizer.ts'

test('sanitizeUrl prevents XSS and malformed protocols', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('vbscript:msgbox(1)'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4='), FALLBACK_LOGO)
  assert.equal(sanitizeUrl(''), FALLBACK_LOGO)
  assert.equal(sanitizeUrl(null), FALLBACK_LOGO)
  assert.equal(sanitizeUrl(undefined), FALLBACK_LOGO)
  assert.equal(
    sanitizeUrl('https://a.espncdn.com/logo.png'),
    'https://a.espncdn.com/logo.png'
  )
  assert.equal(
    sanitizeUrl('http://example.com/logo.png'),
    'http://example.com/logo.png'
  )
  assert.equal(
    sanitizeUrl('data:image/svg+xml;utf8,<svg></svg>'),
    'data:image/svg+xml;utf8,<svg></svg>'
  )
})

test('normalizeNFLEvent handles null, undefined, and empty objects without crashing', () => {
  const e1 = normalizeNFLEvent(null)
  assert.ok(e1)
  assert.equal(e1.state, 'pre')
  assert.equal(e1.home.team.abbreviation, 'HOME')
  assert.equal(e1.away.team.abbreviation, 'AWAY')
  assert.equal(e1.situation, null)

  const e2 = normalizeNFLEvent(undefined)
  assert.ok(e2)

  const e3 = normalizeNFLEvent({})
  assert.ok(e3)

  const e4 = normalizeNFLEvent({ competitions: [] })
  assert.ok(e4)

  const e5 = normalizeNFLEvent({
    competitions: [{ competitors: null, situation: null }],
  })
  assert.ok(e5)
  assert.equal(e5.home.score, 0)
  assert.equal(e5.away.score, 0)
})

test('normalizeNFLEvent clamps out-of-bounds situation coordinates', () => {
  const raw = {
    status: { type: { state: 'in' } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', id: '1', score: '14' },
          { homeAway: 'away', id: '2', score: '7' },
        ],
        situation: {
          yardLine: -500, // Invalid negative
          down: 99,
          distance: -20,
          possession: '1',
          lastPlay: {
            probability: {
              homeWinPercentage: 250, // Out of bounds
            },
          },
        },
      },
    ],
  }

  const normalized = normalizeNFLEvent(raw)
  assert.ok(normalized.situation)
  assert.equal(normalized.situation.yardLine, 0) // Clamped to 0
  assert.equal(normalized.situation.scrimmageX, 100) // Clamped to goal line
  assert.equal(normalized.situation.distance, 0)
  assert.ok(normalized.situation.homeWinPct <= 98)
  assert.ok(normalized.situation.homeWinPct >= 2)
})

test('Fuzz Stress Test: 1,000 random chaotic payloads never throw an uncaught error', () => {
  const chaoticValues = [
    null,
    undefined,
    '',
    'random_string',
    -1,
    0,
    999999,
    NaN,
    Infinity,
    -Infinity,
    [],
    [null, 1, 'str'],
    {},
    { id: null, score: '-' },
    { team: { color: 'invalid-hex' } },
    { situation: { down: null, yardLine: undefined } },
    { status: { type: { state: 'UNKNOWN_STATE' } } },
  ]

  for (let i = 0; i < 1000; i++) {
    const randomPayload = {
      id: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
      name: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
      date: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
      status: {
        clock: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
        displayClock: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
        period: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
        type: {
          state: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
          detail: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
        },
      },
      competitions: [
        {
          competitors: [
            {
              id: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
              homeAway: i % 2 === 0 ? 'home' : 'away',
              score: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
              team: {
                id: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
                name: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
                color: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
                logo: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
              },
            },
          ],
          situation: {
            down: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
            yardLine: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
            distance: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
            possession: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
            lastPlay: {
              text: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
              probability: {
                homeWinPercentage: chaoticValues[Math.floor(Math.random() * chaoticValues.length)],
              },
            },
          },
        },
      ],
    }

    assert.doesNotThrow(() => {
      const res = normalizeNFLEvent(randomPayload, i)
      assert.ok(res)
      assert.ok(typeof res.id === 'string')
      assert.ok(typeof res.home.team.color === 'string')
      assert.ok(typeof res.away.team.color === 'string')
    })
  }
})
