import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeUrl, FALLBACK_LOGO, normalizeNFLEvent } from './normalizer.ts'
import {
  safeParseInt,
  sanitizeHexColor,
  sanitizePatriotsName,
  sanitizePatriotsAbbreviation,
  formatDownAndDistance,
  isRedZoneSituation,
  isHalftimeSituation,
} from './nflHelpers.ts'
import { calculateWinProbability } from './winProbability.ts'
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
// PILLAR 1: SECURITY AND SANITISATION AUDIT
// ============================================================================

test('Security Audit: sanitizeUrl blocks base64-encoded SVG script injection vectors', () => {
  // Base64 for <svg onload=alert(1)>
  const b64Onload = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+'
  assert.equal(sanitizeUrl(b64Onload), FALLBACK_LOGO)

  // Base64 for <svg><script>alert(document.cookie)</script></svg>
  const b64Script = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KGRvY3VtZW50LmNvb2tpZSk8L3NjcmlwdD48L3N2Zz4='
  assert.equal(sanitizeUrl(b64Script), FALLBACK_LOGO)

  // Base64 for <svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>
  const b64Foreign = 'data:image/svg+xml;base64,PHN2Zz48Zm9yZWlnbk9iamVjdD48aWZyYW1lIHNyYz0iamF2YXNjcmlwdDphbGVydCgxKSI+PC9pZnJhbWU+PC9mb3JlaWduT2JqZWN0Pjwvc3ZnPg=='
  assert.equal(sanitizeUrl(b64Foreign), FALLBACK_LOGO)
})

test('Security Audit: sanitizeUrl blocks URL-encoded SVG scripts and dangerous elements', () => {
  // URL-encoded script tag in SVG
  const urlEncodedScript = 'data:image/svg+xml;utf8,%3Csvg%20onload=alert(1)%3E%3C/svg%3E'
  assert.equal(sanitizeUrl(urlEncodedScript), FALLBACK_LOGO)

  // SVG with dangerous XML entity injection
  const xmlEntity = 'data:image/svg+xml;utf8,<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>'
  assert.equal(sanitizeUrl(xmlEntity), FALLBACK_LOGO)

  // SVG with animation event handler
  const animateHandler = 'data:image/svg+xml;utf8,<svg><animate onbegin=alert(1) attributeName=x dur=1s /></svg>'
  assert.equal(sanitizeUrl(animateHandler), FALLBACK_LOGO)

  // SVG with use tag referencing external script
  const useTag = 'data:image/svg+xml;utf8,<svg><use href="evil.svg#payload"/></svg>'
  assert.equal(sanitizeUrl(useTag), FALLBACK_LOGO)
})

test('Security Audit: sanitizeUrl blocks credentials phishing and forbidden protocols', () => {
  // Userinfo in HTTP / HTTPS URL
  assert.equal(sanitizeUrl('https://admin:hunter2@malicious.com/logo.png'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('http://user:pass@evil.com/pic.jpg'), FALLBACK_LOGO)

  // Dangerous pseudo-protocols
  assert.equal(sanitizeUrl('blob:https://example.com/uuid'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('data:application/javascript;base64,YWxlcnQoMSk='), FALLBACK_LOGO)

  // Unicode directional override attacks (trojan source)
  assert.equal(sanitizeUrl('https://evil.com/\u202Ereversed/logo.png'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('https://evil.com/\u200Ehidden/logo.png'), FALLBACK_LOGO)
})

test('Security Audit: sanitizeUrl permits authentic raster images and clean SVGs', () => {
  // Clean raster base64 (1x1 transparent PNG)
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  assert.equal(sanitizeUrl(validPng), validPng)

  // Clean WebP raster base64
  const validWebp = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
  assert.equal(sanitizeUrl(validWebp), validWebp)

  // Clean vector SVG
  const validSvg = 'data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="navy"/></svg>'
  assert.equal(sanitizeUrl(validSvg), validSvg)

  // Clean ESPN CDN HTTPS URL
  const espnUrl = 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png'
  assert.equal(sanitizeUrl(espnUrl), espnUrl)
})

test('Security Audit: sanitizeHexColor rejects CSS injection and malformed hex strings', () => {
  assert.equal(sanitizeHexColor('#ff0000; background: url(x)'), '#1e3a8a')
  assert.equal(sanitizeHexColor('expression(alert(1))'), '#1e3a8a')
  assert.equal(sanitizeHexColor('#12'), '#1e3a8a')
  assert.equal(sanitizeHexColor('#12345'), '#1e3a8a')
  assert.equal(sanitizeHexColor('#1234567'), '#1e3a8a')
  assert.equal(sanitizeHexColor('transparent'), '#1e3a8a')
  assert.equal(sanitizeHexColor(null), '#1e3a8a')
  assert.equal(sanitizeHexColor(undefined), '#1e3a8a')
  // Valid conversions
  assert.equal(sanitizeHexColor('#f00'), '#ff0000')
  assert.equal(sanitizeHexColor('0ea5e9'), '#0ea5e9')
})

test('Security Audit: sanitizePatriotsName handles non-strings, prototype keys, and objects', () => {
  assert.equal(sanitizePatriotsName(null), '')
  assert.equal(sanitizePatriotsName(undefined), '')
  assert.equal(sanitizePatriotsName(12345), '')
  assert.equal(sanitizePatriotsName({}), '')
  assert.equal(sanitizePatriotsName(['New England Patriots']), '')
  assert.equal(sanitizePatriotsName('__proto__'), '__proto__')
  assert.equal(sanitizePatriotsName('constructor'), 'constructor')

  // Invariant guarantees
  assert.equal(sanitizePatriotsName('NE'), 'FNE')
  assert.equal(sanitizePatriotsName('ne'), 'FNE')
  assert.equal(sanitizePatriotsName('New England Patriots'), 'Fucking New England Patriots')
  assert.equal(sanitizePatriotsName('Patriots'), 'Fucking Patriots')
  assert.equal(sanitizePatriotsName('Pats'), 'Fucking Pats')
  assert.equal(sanitizePatriotsName('Fucking New England Patriots'), 'Fucking New England Patriots')

  // Abbreviation sanitization guarantees
  assert.equal(sanitizePatriotsAbbreviation('NE'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('ne'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('FNE'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('KC'), 'KC')
  assert.equal(sanitizePatriotsAbbreviation(null), '')
  assert.equal(sanitizePatriotsAbbreviation(undefined), '')

  // Down and Distance sanitization guarantees
  assert.equal(formatDownAndDistance({ down: 3, distance: 4, possessionText: 'NE 20' }), '3rd & 4 at FNE 20')
  assert.equal(formatDownAndDistance(null), 'Between Plays')
  assert.equal(formatDownAndDistance({ down: -1 }), 'Kickoff / PAT Attempt')
})

// ============================================================================
// PILLAR 2: EDGE CASE AND LOGIC ISOLATION AUDIT
// ============================================================================

test('Edge Case Audit: safeParseInt handles extreme numbers, symbols, and whitespace', () => {
  assert.equal(safeParseInt(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER)
  assert.equal(safeParseInt(-999), -999)
  assert.equal(safeParseInt(Infinity, 42), 42)
  assert.equal(safeParseInt(-Infinity, 42), 42)
  assert.equal(safeParseInt(NaN, 42), 42)
  assert.equal(safeParseInt('   14   '), 14)
  assert.equal(safeParseInt('   -   ', 0), 0)
  assert.equal(safeParseInt('', 7), 7)
})

test('Edge Case Audit: calculateWinProbability handles extreme and abnormal parameters', () => {
  const dummyHome = {
    id: '1',
    homeAway: 'home',
    score: 0,
    team: { displayName: 'Kansas City Chiefs', abbreviation: 'KC' },
  }
  const dummyAway = {
    id: '2',
    homeAway: 'away',
    score: 0,
    team: { displayName: 'Buffalo Bills', abbreviation: 'BUF' },
  }

  // 1. In-game with NaN and infinite probabilities
  const res1 = calculateWinProbability({
    homeWinPercentage: NaN,
    awayWinPercentage: Infinity,
    homeCompetitor: dummyHome,
    awayCompetitor: dummyAway,
    gameState: 'in',
  })
  assert.ok(Number.isFinite(res1.homePct))
  assert.ok(Number.isFinite(res1.awayPct))
  assert.equal(Math.round(res1.homePct + res1.awayPct), 100)

  // 2. Pre-game with extreme/malformed moneyline odds
  const res2 = calculateWinProbability({
    homeCompetitor: dummyHome,
    awayCompetitor: dummyAway,
    gameState: 'pre',
    odds: [
      {
        provider: { name: 'DraftKings' },
        moneyline: {
          home: { close: { odds: '+999999' } },
          away: { close: { odds: '-999999' } },
        },
      },
    ],
  })
  assert.ok(res2.homePct >= 1 && res2.homePct <= 99)
  assert.ok(res2.awayPct >= 1 && res2.awayPct <= 99)
  assert.equal(Math.round(res2.homePct + res2.awayPct), 100)

  // 3. Post-game tied score
  const res3 = calculateWinProbability({
    homeCompetitor: { ...dummyHome, score: 20 },
    awayCompetitor: { ...dummyAway, score: 20 },
    gameState: 'post',
  })
  assert.equal(res3.homePct, 50)
  assert.equal(res3.awayPct, 50)
  assert.equal(res3.favoredName, 'Tied')
})

test('Edge Case Audit: normalizeNFLEvent clamps out-of-bounds coordinates and preserves safety', () => {
  const chaoticInput = {
    id: 'chaotic-1',
    status: {
      period: 9999,
      clock: -500,
      displayClock: '-8:22',
      type: { state: 'in' },
    },
    competitions: [
      {
        situation: {
          yardLine: 9999,
          down: 99,
          distance: -50,
          possessionText: 'NE 15',
        },
        competitors: [
          { homeAway: 'home', score: 9999, team: { abbreviation: 'NE', name: 'Patriots' } },
          { homeAway: 'away', score: -10, team: { abbreviation: 'MIA', name: 'Dolphins' } },
        ],
      },
    ],
  }

  const normalized = normalizeNFLEvent(chaoticInput)
  assert.equal(normalized.situation?.yardLine, 100) // Clamped to 100
  assert.equal(normalized.situation?.distance, 0)   // Clamped to 0
  assert.equal(normalized.home.team.abbreviation, 'FNE')
  assert.equal(normalized.home.team.displayName, 'Fucking Patriots')
  assert.equal(normalized.home.score, 9999)
  assert.equal(normalized.away.score, -10)
  assert.ok(Number.isFinite(normalized.situation?.homeWinPct))
  assert.ok(Number.isFinite(normalized.situation?.awayWinPct))
})

// ============================================================================
// PILLAR 3: PERFORMANCE AND RESOURCE AUDITING
// ============================================================================

test('Performance Audit: getDrivePointsDistribution precomputed lookup is O(1) and sums to 1.0', () => {
  for (let drives = 1; drives <= 16; drives++) {
    const dist = getDrivePointsDistribution(drives)
    assert.ok(dist instanceof Float64Array)
    assert.equal(dist.length, 100)

    // Verify conservation of total probability (> 99.8% retained within 0-99 pt bounds)
    let sum = 0
    for (let i = 0; i < dist.length; i++) {
      sum += dist[i]
    }
    assert.ok(Math.abs(sum - 1.0) < 0.005, `Drive distribution for ${drives} drives must sum to ~1.0, got ${sum}`)

    // Verify exact object reference caching (zero dynamic memory allocation)
    const secondFetch = getDrivePointsDistribution(drives)
    assert.equal(dist, secondFetch, `Expected precomputed array reference for ${drives} drives`)
  }
})

test('Resource Audit: audioFeedback handles high-frequency bursts without unhandled exceptions', () => {
  // Fire 50 calls in rapid succession (simulating rapid automated events)
  for (let i = 0; i < 20; i++) {
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)
  }
  // Muted mode must be a clean no-op
  playRedZoneSound(true)
  playScoreChime(true)
  playTactileClick(true)
  assert.ok(true, 'Audio feedback executed cleanly under burst load')
})

// ============================================================================
// PILLAR 4: SCORIGAMI & BROADCAST BOUNDARY AUDIT
// ============================================================================

test('Boundary Audit: Scorigami handles massive blowouts and negative seconds remaining', () => {
  // Historic 73-0 Championship game
  const scorigami73 = getScorigamiInfo(73, 0, 0, 'post')
  assert.equal(scorigami73.isCurrentScorigami, false)
  assert.equal(scorigami73.currentOccurrences, 1)
  assert.ok(scorigami73.lastGameSummary?.includes('Chicago Bears 73'))

  // Novel blowout score 110-3
  const novelBlowout = getScorigamiInfo(110, 3, 0, 'post')
  assert.equal(novelBlowout.isCurrentScorigami, true)
  assert.equal(novelBlowout.chanceLabel, '100% — Historical Scorigami!')

  // Negative seconds remaining in live game
  const negSeconds = getScorigamiInfo(24, 21, -120, 'in')
  assert.ok(Number.isFinite(negSeconds.chancePct))
  assert.ok(negSeconds.chanceLabel)

  // Canonical score keys and historical registry invariants
  assert.equal(makeScoreKey(24, 17), '24-17')
  assert.equal(makeScoreKey(17, 24), '24-17')
  assert.equal(hasOccurred(20, 17), true)
  assert.equal(hasOccurred(110, 3), false)
  const rec = getHistoricalRecord(20, 17)
  assert.ok(rec !== null)
  assert.ok(rec[0] > 0)

  // True regulation seconds remaining boundary invariants
  assert.equal(getGameSecondsRemaining({ period: 1, clock: 900 }, 'in'), 3600)
  assert.equal(getGameSecondsRemaining({ period: 4, clock: 0 }, 'in'), 0)
  assert.equal(getGameSecondsRemaining(null, 'pre'), 3600)
  assert.equal(getGameSecondsRemaining(null, 'post'), 0)
})

test('Boundary Audit: isRedZoneSituation and isHalftimeSituation precision', () => {
  // Halftime status
  assert.equal(isHalftimeSituation({ type: { name: 'STATUS_HALFTIME' } }), true)
  assert.equal(isHalftimeSituation({ type: { detail: 'Halftime' } }), true)
  assert.equal(isHalftimeSituation({ type: { detail: 'End of 1st Half' } }), true)
  assert.equal(isHalftimeSituation({ type: { state: 'in' }, period: 2, clock: 0 }), true)
  assert.equal(isHalftimeSituation({ type: { state: 'in' }, period: 1, clock: 0 }), false)

  // Red Zone: Kickoff must be rejected even with ESPN isRedZone flag
  const kickoffSit = { down: -1, yardLine: 85, isRedZone: true }
  const liveStatus = { type: { state: 'in', name: 'STATUS_IN_PROGRESS' }, clock: 300 }
  assert.equal(isRedZoneSituation(kickoffSit, liveStatus, []), false)

  // Red Zone: 0:00 on the clock must be rejected
  const expiredSit = { down: 2, yardLine: 95, isRedZone: true }
  const expiredStatus = { type: { state: 'in' }, clock: 0 }
  assert.equal(isRedZoneSituation(expiredSit, expiredStatus, []), false)
})
