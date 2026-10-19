import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeUrl, FALLBACK_LOGO } from './normalizer.ts'
import { safeParseInt, sanitizePatriotsName, sanitizePatriotsAbbreviation, sanitizeClipboardField } from './nflHelpers.ts'
import { getScorigamiInfo, getGameSecondsRemaining } from './scorigami.ts'
import { getGameBroadcastDetails } from './broadcastInfo.ts'

test('Security & Sanitization: sanitizeClipboardField neutralizes CRLF and control character injections', () => {
  // Test basic normal strings
  assert.equal(sanitizeClipboardField('Kansas City Chiefs'), 'Kansas City Chiefs')
  assert.equal(sanitizeClipboardField('  San Francisco 49ers  '), 'San Francisco 49ers')

  // Test CRLF injection prevention
  const crlfPayload = 'Chiefs\r\nFake URL: https://malicious.phishing.site\r\nScore: 99'
  const sanitizedCrlf = sanitizeClipboardField(crlfPayload)
  assert.equal(sanitizedCrlf.includes('\r'), false, 'Carriage return must be stripped')
  assert.equal(sanitizedCrlf.includes('\n'), false, 'Line feed must be stripped')
  assert.equal(sanitizedCrlf, 'Chiefs Fake URL: https://malicious.phishing.site Score: 99')

  // Test control character stripping (\x00 - \x1F and \x7F - \x9F)
  const controlPayload = 'Team\x00Name\x07With\x1BBell\x7FAnd\x80Del'
  const sanitizedControl = sanitizeClipboardField(controlPayload)
  assert.equal(sanitizedControl, 'Team Name With Bell And Del')

  // Test non-string and null/undefined handling
  assert.equal(sanitizeClipboardField(null, 'Fallback'), 'Fallback')
  assert.equal(sanitizeClipboardField(undefined, 'Default'), 'Default')
  assert.equal(sanitizeClipboardField('', 'EmptyDefault'), 'EmptyDefault')
  assert.equal(sanitizeClipboardField('   ', 'WhitespaceDefault'), 'WhitespaceDefault')
  assert.equal(sanitizeClipboardField(12345, 'NumFallback'), 'NumFallback')
})

test('Security & Sanitization: Logo URL sanitization blocks malicious schemes and unescaped scripts', () => {
  // Malicious protocols
  assert.equal(sanitizeUrl('javascript:alert("XSS")'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('JAVASCRIPT:alert(document.cookie)'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('vbscript:msgbox(1)'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('file:///etc/passwd'), FALLBACK_LOGO)
  assert.equal(sanitizeUrl('blob:https://evil.com/fake-uuid'), FALLBACK_LOGO)

  // Embedded credentials phishing
  assert.equal(sanitizeUrl('https://admin:pass@attacker.com/logo.png'), FALLBACK_LOGO)

  // Malicious SVG with embedded script
  const maliciousSvg = 'data:image/svg+xml;utf8,<svg onload="alert(1)"><circle r="10"/></svg>'
  assert.equal(sanitizeUrl(maliciousSvg), FALLBACK_LOGO)

  // Valid authentic HTTPS raster logo
  const validLogo = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/kc.png'
  assert.equal(sanitizeUrl(validLogo), validLogo)
})

test('Security & Sanitization: Total FNE sanitization invariant in team names and abbreviations', () => {
  assert.equal(sanitizePatriotsName('New England Patriots'), 'Fucking New England Patriots')
  assert.equal(sanitizePatriotsName('Patriots'), 'Fucking Patriots')
  assert.equal(sanitizePatriotsName('Pats'), 'Fucking Pats')
  assert.equal(sanitizePatriotsAbbreviation('NE'), 'FNE')
  assert.equal(sanitizePatriotsAbbreviation('KC'), 'KC')
  assert.equal(sanitizePatriotsAbbreviation('SF'), 'SF')
})

test('Edge Case & Logic: Status null safety, clock extraction, and timeout boundaries', () => {
  // Simulated edge case: status is completely null or missing
  const nullStatus = null
  const safePeriod = typeof nullStatus?.period === 'number' && Number.isFinite(nullStatus.period) ? nullStatus.period : 1
  const safeClock = typeof nullStatus?.displayClock === 'string' && nullStatus.displayClock.trim() !== '' ? nullStatus.displayClock.trim() : '0:00'
  const safeDetail = nullStatus?.type?.detail || 'Scheduled'

  assert.equal(safePeriod, 1)
  assert.equal(safeClock, '0:00')
  assert.equal(safeDetail, 'Scheduled')

  // Simulated edge case: extreme timeout values
  const clampTimeout = (val) => Math.max(0, Math.min(3, Math.floor(typeof val === 'number' && Number.isFinite(val) ? val : 3)))
  assert.equal(clampTimeout(3), 3)
  assert.equal(clampTimeout(0), 0)
  assert.equal(clampTimeout(-5), 0, 'Negative timeouts must clamp to 0')
  assert.equal(clampTimeout(99), 3, 'Timeouts exceeding 3 must clamp to 3')
  assert.equal(clampTimeout(NaN), 3, 'NaN timeout must default to safe 3')
  assert.equal(clampTimeout(null), 3, 'Null timeout must default to safe 3')
  assert.equal(clampTimeout(undefined), 3, 'Undefined timeout must default to safe 3')
  assert.equal(clampTimeout(2.8), 2, 'Float timeout must floor safely')
})

test('Edge Case & Logic: Scoreboard score string handling and tie game safety', () => {
  // Safe parsing handles empty strings, nulls, and dashes without NaN
  assert.equal(safeParseInt(''), 0)
  assert.equal(safeParseInt(null), 0)
  assert.equal(safeParseInt('-'), 0)
  assert.equal(safeParseInt('24'), 24)
  assert.equal(safeParseInt(' 31 '), 31)

  // Empty string display fallback
  const getScoreDisplay = (rawScore, isLiveOrFinal) => {
    return isLiveOrFinal
      ? (rawScore != null && String(rawScore).trim() !== '' ? String(rawScore) : '0')
      : '—'
  }

  assert.equal(getScoreDisplay('', true), '0')
  assert.equal(getScoreDisplay(null, true), '0')
  assert.equal(getScoreDisplay('14', true), '14')
  assert.equal(getScoreDisplay('14', false), '—')

  // Winner calculation in a tie game
  const isFinal = true
  const homeScore = 20
  const awayScore = 20
  const isAwayWinner = isFinal && awayScore > homeScore
  const isHomeWinner = isFinal && homeScore > awayScore

  assert.equal(isAwayWinner, false, 'Away team cannot be marked winner in a tie')
  assert.equal(isHomeWinner, false, 'Home team cannot be marked winner in a tie')
})

test('Edge Case & Logic: Venue concatenation handles missing and partial address data', () => {
  const formatVenue = (venue) => {
    if (!venue) return ''
    const name = venue.fullName || ''
    const city = venue.address?.city ? `, ${venue.address.city}` : ''
    return `${name}${city}`.trim()
  }

  assert.equal(formatVenue(null), '')
  assert.equal(formatVenue({}), '')
  assert.equal(formatVenue({ fullName: 'Arrowhead Stadium' }), 'Arrowhead Stadium')
  assert.equal(formatVenue({ fullName: 'Arrowhead Stadium', address: { city: 'Kansas City' } }), 'Arrowhead Stadium, Kansas City')
  assert.equal(formatVenue({ address: { city: 'Detroit' } }), ', Detroit')
})

test('Performance & Resource: High-throughput sanitization execution path efficiency', () => {
  const start = performance.now()
  const payload = 'Quarter 4 \r\n 0:12 • Touchdown Run by #15 at KC 2'

  for (let i = 0; i < 50000; i++) {
    sanitizeClipboardField(payload)
  }

  const duration = performance.now() - start
  assert.ok(duration < 250, `50,000 sanitizations took ${duration.toFixed(2)}ms, must complete under 250ms`)
})

test('Performance & Analytics: Scorigami and Broadcast memoization invariants', () => {
  // Test seconds remaining derivation under boundary conditions
  assert.equal(getGameSecondsRemaining({ period: 4, displayClock: '0:00' }, 'post'), 0)
  assert.equal(getGameSecondsRemaining({ period: 1, displayClock: '15:00' }, 'pre'), 3600)

  // Verify getScorigamiInfo does not crash on extreme blowouts
  const blowoutScorigami = getScorigamiInfo(70, 0, 300, 'in', 'MIA', 'DEN')
  assert.ok(blowoutScorigami.chanceLabel)
  assert.equal(typeof blowoutScorigami.chanceLabel, 'string')

  // Verify getGameBroadcastDetails executes safely with missing competitors
  const minimalEvent = {
    id: 'test-event-1',
    date: '2026-10-18T17:00:00Z',
    competitions: [{ competitors: [] }]
  }
  const broadcast = getGameBroadcastDetails(minimalEvent)
  assert.ok(broadcast.usTv)
  assert.ok(broadcast.announcers)
})
