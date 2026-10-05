import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeUrl, FALLBACK_LOGO, normalizeNFLEvent } from './normalizer.ts'
import {
  safeParseInt,
  sanitizeHexColor,
  sanitizePatriotsName,
  sanitizePatriotsAbbreviation,
  sanitizePatriotsInEvent,
  sanitizePatriotsInScoreboardData,
  areColorsTooSimilar,
  resolveContrastingTeamColors,
} from './nflHelpers.ts'
import { normalCdf, calculateWinProbability } from './winProbability.ts'
import {
  makeScoreKey,
  hasOccurred,
  getHistoricalRecord,
  getGameSecondsRemaining,
  getScorigamiInfo,
  getDrivePointsDistribution,
} from './scorigami.ts'
import { playRedZoneSound, playScoreChime, playTactileClick } from './audioFeedback.ts'

// ============================================================================
// PARAMETER 1: SECURITY & SANITISATION RIGOROUS AUDIT
// ============================================================================

test('Security Audit: sanitizeUrl blocks HTML/XML entity obfuscated protocols in SVG and URLs', () => {
  // Hex entity obfuscation: "jav&#x61;script:alert(1)"
  const hexEntitySvg = 'data:image/svg+xml;utf8,<svg><a href="jav&#x61;script:alert(1)"><circle r="10"/></a></svg>'
  assert.equal(sanitizeUrl(hexEntitySvg), FALLBACK_LOGO)

  // Full decimal entity string: "&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)"
  const decEntitySvg = 'data:image/svg+xml;utf8,<svg><a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)"><circle r="10"/></a></svg>'
  assert.equal(sanitizeUrl(decEntitySvg), FALLBACK_LOGO)

  // Named entity colon: "javascript&colon;alert(1)"
  const namedColonSvg = 'data:image/svg+xml;utf8,<svg><a xlink:href="javascript&colon;alert(1)"><circle r="10"/></a></svg>'
  assert.equal(sanitizeUrl(namedColonSvg), FALLBACK_LOGO)
})

test('Security Audit: sanitizeUrl blocks style tags, CSS injection, and external imports in SVG', () => {
  // Embedded style with CSS @import
  const styleImportSvg = 'data:image/svg+xml;utf8,<svg><style>@import url("https://attacker.com/evil.css");</style><circle r="10"/></svg>'
  assert.equal(sanitizeUrl(styleImportSvg), FALLBACK_LOGO)

  // Base64 encoded style tag
  const rawStyle = '<svg><style>circle { fill: red; }</style></svg>'
  const b64Style = `data:image/svg+xml;base64,${Buffer.from(rawStyle).toString('base64')}`
  assert.equal(sanitizeUrl(b64Style), FALLBACK_LOGO)

  // Dangerous XML DOCTYPE and ENTITY declarations
  const doctypeSvg = 'data:image/svg+xml;utf8,<!DOCTYPE svg SYSTEM "http://attacker.com/evil.dtd"><svg><circle r="10"/></svg>'
  assert.equal(sanitizeUrl(doctypeSvg), FALLBACK_LOGO)
})

test('Security Audit: sanitizeUrl rejects untrusted fallback parameters', () => {
  // If a caller provides an untrusted/malicious fallback parameter
  const maliciousFallback = 'javascript:alert(document.domain)'
  assert.equal(sanitizeUrl('invalid-url', maliciousFallback), FALLBACK_LOGO)

  const emptyFallback = '   '
  assert.equal(sanitizeUrl('invalid-url', emptyFallback), FALLBACK_LOGO)

  // Legitimate HTTP/HTTPS fallback is preserved
  const validFallback = 'https://custom-cdn.com/fallback.png'
  assert.equal(sanitizeUrl('invalid-url', validFallback), validFallback)
})

test('Security Audit: sanitizeHexColor neutralizes CSS injection and untrusted fallback strings', () => {
  // Injection via value
  assert.equal(sanitizeHexColor('red; background: url(evil.png)'), '#1e3a8a')
  assert.equal(sanitizeHexColor('#123/*comment*/'), '#1e3a8a')
  assert.equal(sanitizeHexColor('blue" onmouseover="alert(1)'), '#1e3a8a')

  // Injection via fallback parameter
  assert.equal(sanitizeHexColor('invalid', 'blue; font-size: 100px'), '#1e3a8a')
  assert.equal(sanitizeHexColor('invalid', 'javascript:void(0)'), '#1e3a8a')

  // Valid 3-char and 6-char colors normalized to clean lowercase 6-char hex
  assert.equal(sanitizeHexColor('#FFF'), '#ffffff')
  assert.equal(sanitizeHexColor('00338D'), '#00338d')
  assert.equal(sanitizeHexColor('  #abc  '), '#aabbcc')
})

test('Security Audit: Prototype pollution resistance across all utility pipelines', () => {
  const pollutedPayload = JSON.parse('{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"admin": true}}, "name": "NE @ KC"}')

  // Ensure Object.prototype remains clean
  assert.equal(({}).polluted, undefined)
  assert.equal(({}).admin, undefined)

  // Normalize event with polluted payload
  const normalized = normalizeNFLEvent(pollutedPayload)
  assert.equal(typeof normalized.id, 'string')
  assert.equal(({}).polluted, undefined)
  assert.equal(({}).admin, undefined)

  // Sanitize event with polluted payload
  const sanitized = sanitizePatriotsInEvent(pollutedPayload)
  assert.equal(({}).polluted, undefined)
  assert.equal(({}).admin, undefined)
  assert.ok(sanitized)
})

// ============================================================================
// PARAMETER 2: EDGE CASE, IMMUTABILITY & LOGIC ISOLATION
// ============================================================================

test('Logic Isolation: sanitizePatriotsInEvent is 100% pure and never mutates input objects', () => {
  const originalEvent = Object.freeze({
    id: '401671800',
    name: 'New England Patriots at Miami Dolphins',
    shortName: 'NE @ MIA',
    competitions: Object.freeze([
      Object.freeze({
        competitors: Object.freeze([
          Object.freeze({
            homeAway: 'home',
            team: Object.freeze({
              id: '15',
              displayName: 'Miami Dolphins',
              name: 'Dolphins',
              abbreviation: 'MIA',
            }),
          }),
          Object.freeze({
            homeAway: 'away',
            team: Object.freeze({
              id: '17',
              displayName: 'New England Patriots',
              name: 'Patriots',
              abbreviation: 'NE',
            }),
          }),
        ]),
        situation: Object.freeze({
          possessionText: 'NE 35',
          downDistanceText: '3rd & 4 at NE 35',
          shortDownDistanceText: '3rd & 4',
          lastPlay: Object.freeze({
            text: 'Patriots pass complete to the 40.',
          }),
        }),
      }),
    ]),
  })

  // Must NOT throw TypeError: Cannot assign to read only property
  const result = sanitizePatriotsInEvent(originalEvent)

  // Verified pure cloning
  assert.notEqual(result, originalEvent)
  assert.equal(originalEvent.name, 'New England Patriots at Miami Dolphins')
  assert.equal(originalEvent.shortName, 'NE @ MIA')
  assert.equal(originalEvent.competitions[0].competitors[1].team.abbreviation, 'NE')
  assert.equal(originalEvent.competitions[0].situation.possessionText, 'NE 35')

  // Verified sanitization applied to clone
  assert.equal(result.name, 'Fucking New England Patriots at Miami Dolphins')
  assert.equal(result.shortName, 'FNE @ MIA')
  assert.equal(result.competitions[0].competitors[1].team.abbreviation, 'FNE')
  assert.equal(result.competitions[0].competitors[1].team.displayName, 'Fucking New England Patriots')
  assert.equal(result.competitions[0].situation.possessionText, 'FNE 35')
  assert.equal(result.competitions[0].situation.lastPlay.text, 'Fucking Patriots pass complete to the 40.')
})

test('Logic Isolation: sanitizePatriotsInEvent handles circular references gracefully', () => {
  const circularObj = {
    name: 'New England Patriots at New York Jets',
    shortName: 'NE @ NYJ',
  }
  circularObj.self = circularObj

  // Must not throw RangeError: Maximum call stack size exceeded
  const sanitized = sanitizePatriotsInEvent(circularObj)
  assert.equal(sanitized.name, 'Fucking New England Patriots at New York Jets')
  assert.equal(sanitized.shortName, 'FNE @ NYJ')
  assert.equal(sanitized.self, sanitized)
})

test('Edge Case Audit: safeParseInt handles non-primitive types and NaN fallbacks', () => {
  assert.equal(safeParseInt({}, 10), 10)
  assert.equal(safeParseInt([], 20), 20)
  assert.equal(safeParseInt(true, 30), 30)
  assert.equal(safeParseInt(false, 40), 40)
  assert.equal(safeParseInt(NaN, 50), 50)
  assert.equal(safeParseInt('NaN', 60), 60)
  assert.equal(safeParseInt('Infinity', 70), 70)
  // If caller passes NaN as fallback, default to 0
  assert.equal(safeParseInt('invalid', NaN), 0)
})

test('Edge Case Audit: normalCdf handles non-finite inputs, Infinities, and boundary saturations', () => {
  assert.equal(normalCdf(NaN), 0.5)
  assert.equal(normalCdf(Infinity), 1)
  assert.equal(normalCdf(-Infinity), 0)
  assert.equal(normalCdf(0), 0.5)
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 0.001)
  assert.ok(Math.abs(normalCdf(-1.96) - 0.025) < 0.001)
})

test('Edge Case Audit: calculateWinProbability handles extreme blowouts, 0 seconds remaining, and missing competitors', () => {
  // Zero seconds remaining in 4th quarter with massive lead
  const blowout = calculateWinProbability({
    homeCompetitor: { score: 70, team: { abbreviation: 'KC' } },
    awayCompetitor: { score: 0, team: { abbreviation: 'LV' } },
    gameState: 'in',
    status: { period: 4, clock: 0 },
  })
  assert.equal(blowout.homePct, 99.9)
  assert.equal(blowout.awayPct, 0.1)
  assert.equal(blowout.isHomeFavored, true)

  // Extreme underdog pregame moneyline (+50000)
  const extremeOdds = calculateWinProbability({
    homeCompetitor: { team: { abbreviation: 'KC' } },
    awayCompetitor: { team: { abbreviation: 'CAR' } },
    gameState: 'pre',
    odds: [{ moneyline: { home: { close: { odds: -25000 } }, away: { close: { odds: 15000 } } } }],
  })
  assert.ok(Number.isFinite(extremeOdds.homePct))
  assert.ok(extremeOdds.homePct >= 95 && extremeOdds.homePct <= 99)

  // Empty competitors and missing situations
  const emptyGame = calculateWinProbability({
    homeCompetitor: null,
    awayCompetitor: null,
    gameState: 'in',
  })
  assert.ok(Number.isFinite(emptyGame.homePct))
  assert.ok(Number.isFinite(emptyGame.awayPct))
  assert.equal(emptyGame.homePct + emptyGame.awayPct, 100)
})

test('Edge Case Audit: getGameSecondsRemaining boundary precision across periods', () => {
  // Period 0 (unstarted / pre-game)
  assert.equal(getGameSecondsRemaining({ period: 0, clock: 900 }, 'in'), 3600)

  // Negative clock on expiry
  assert.equal(getGameSecondsRemaining({ period: 4, clock: -10 }, 'in'), 0)

  // Postseason double overtime (period 6, 800s left)
  assert.equal(getGameSecondsRemaining({ period: 6, clock: 800 }, 'in'), 800)

  // Missing status object
  assert.equal(getGameSecondsRemaining(null, 'in'), 3600)
})

test('Edge Case Audit: getScorigamiInfo ensures non-empty narrative when current score is novel', () => {
  // 99-98 has never occurred
  const novelBlowout = getScorigamiInfo(99, 98, 0, 'in', 'KC', 'BUF')
  assert.equal(novelBlowout.isCurrentScorigami, true)
  assert.ok(novelBlowout.whenScenario.length > 0)
  assert.ok(novelBlowout.whenScenario.includes('99-98'))
})

// ============================================================================
// PARAMETER 3: PERFORMANCE AND RESOURCE AUDITING
// ============================================================================

test('Performance Audit: sanitizePatriotsInEvent executes 1,000 runs in under 100ms', () => {
  const testEvent = {
    id: 'perf-test-1',
    name: 'New England Patriots at Buffalo Bills',
    shortName: 'NE @ BUF',
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { displayName: 'Buffalo Bills', abbreviation: 'BUF' } },
          { homeAway: 'away', team: { displayName: 'New England Patriots', abbreviation: 'NE' } },
        ],
        situation: {
          possessionText: 'NE 20',
          downDistanceText: '1st & 10 at NE 20',
          lastPlay: { text: 'Patriots rush for 4 yards.' },
        },
      },
    ],
  }

  const start = performance.now()
  for (let i = 0; i < 1000; i++) {
    sanitizePatriotsInEvent(testEvent)
  }
  const duration = performance.now() - start
  assert.ok(duration < 100, `Execution took ${duration.toFixed(2)}ms, expected < 100ms`)
})

test('Performance Audit: Drive points distribution conservation of probability for all drives 1..16', () => {
  for (let d = 1; d <= 16; d++) {
    const dist = getDrivePointsDistribution(d)
    let sum = 0
    for (let i = 0; i < dist.length; i++) {
      sum += dist[i]
    }
    // Sum of probability mass across discrete points must equal ~1.0 (> 99.8% retained within 0-99 pt bounds)
    assert.ok(Math.abs(sum - 1.0) < 0.005, `Drives ${d} probability sum ${sum} diverged from 1.0`)
    // Zero dynamic memory allocation: verify identical Float64Array reference
    assert.equal(dist, getDrivePointsDistribution(d))
  }
})

test('Resource Audit: Web Audio synthesis functions handle headless and repeated triggers safely', () => {
  // Test 100 rapid fire triggers (simulating rapid network events)
  for (let i = 0; i < 100; i++) {
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)
  }
  // Muted mode
  playRedZoneSound(true)
  playScoreChime(true)
  playTactileClick(true)
})

test('Audit Suite: sanitizePatriotsInScoreboardData safely handles frozen scoreboard objects', () => {
  const frozenScoreboard = Object.freeze({
    events: Object.freeze([
      Object.freeze({
        id: '1',
        name: 'New England Patriots at Buffalo Bills',
        competitions: Object.freeze([
          Object.freeze({
            competitors: Object.freeze([
              Object.freeze({ team: Object.freeze({ abbreviation: 'NE', name: 'Patriots' }) }),
            ]),
          }),
        ]),
      }),
    ]),
  })

  const sanitized = sanitizePatriotsInScoreboardData(frozenScoreboard)
  assert.notEqual(sanitized, frozenScoreboard)
  assert.equal(sanitized.events[0].name, 'Fucking New England Patriots at Buffalo Bills')
  assert.equal(sanitized.events[0].competitions[0].competitors[0].team.abbreviation, 'FNE')
  assert.equal(frozenScoreboard.events[0].competitions[0].competitors[0].team.abbreviation, 'NE')
})

test('Audit Suite: sanitizePatriotsName and sanitizePatriotsAbbreviation edge cases', () => {
  assert.equal(sanitizePatriotsName('New England Patriots'), 'Fucking New England Patriots')
  assert.equal(sanitizePatriotsName('Patriots'), 'Fucking Patriots')
  assert.equal(sanitizePatriotsName('the Patriots'), 'the Fucking Patriots')
  assert.equal(sanitizePatriotsName('Pats'), 'Fucking Pats')
  assert.equal(sanitizePatriotsName('NE @ KC'), 'FNE @ KC')
  assert.equal(sanitizePatriotsName(''), '')
  assert.equal(sanitizePatriotsName(null), '')

  assert.equal(sanitizePatriotsAbbreviation('NE'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('ne'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('FNE'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('KC'), 'KC')
  assert.equal(sanitizePatriotsAbbreviation(null), '')
})

test('Audit Suite: areColorsTooSimilar and resolveContrastingTeamColors', () => {
  // Identical or near-identical blues
  assert.equal(areColorsTooSimilar('#002244', '#002244'), true)
  assert.equal(areColorsTooSimilar('#00338d', '#002244'), true)
  // Highly contrasting red vs blue
  assert.equal(areColorsTooSimilar('#e31837', '#00338d'), false)

  const resolved = resolveContrastingTeamColors(
    { team: { color: '#002244', alternateColor: '#ffffff' } },
    { team: { color: '#002244', alternateColor: '#c60c30' } }
  )
  assert.notEqual(resolved.homeColor, resolved.awayColor)
})

test('Audit Suite: makeScoreKey, hasOccurred, and getHistoricalRecord invariants', () => {
  assert.equal(makeScoreKey(24, 17), '24-17')
  assert.equal(makeScoreKey(17, 24), '24-17')
  assert.equal(hasOccurred(20, 17), true)
  assert.equal(hasOccurred(73, 0), true) // 1940 Championship game
  assert.equal(hasOccurred(99, 98), false)

  const record2017 = getHistoricalRecord(20, 17)
  assert.ok(record2017 !== null)
  assert.ok(record2017[0] > 0)
  assert.equal(getHistoricalRecord(99, 98), null)
})

