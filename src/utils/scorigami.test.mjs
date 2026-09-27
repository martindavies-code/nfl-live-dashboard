import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makeScoreKey,
  hasOccurred,
  getHistoricalRecord,
  getGameSecondsRemaining,
  getScorigamiInfo,
} from './scorigami.ts'

test('makeScoreKey always formats winner-loser regardless of input order', () => {
  assert.equal(makeScoreKey(24, 17), '24-17')
  assert.equal(makeScoreKey(17, 24), '24-17')
  assert.equal(makeScoreKey(20, 20), '20-20')
})

test('hasOccurred correctly identifies canonical historical NFL scores', () => {
  // Common scores that have happened hundreds of times
  assert.equal(hasOccurred(20, 17), true)
  assert.equal(hasOccurred(17, 20), true)
  assert.equal(hasOccurred(24, 21), true)
  assert.equal(hasOccurred(27, 24), true)
  assert.equal(hasOccurred(3, 0), true)
  assert.equal(hasOccurred(0, 0), true)

  // Scores that have NEVER occurred in 100+ years of NFL history
  assert.equal(hasOccurred(43, 29), false)
  assert.equal(hasOccurred(36, 23), false)
  assert.equal(hasOccurred(32, 22), false)
  assert.equal(hasOccurred(25, 18), false)
  assert.equal(hasOccurred(11, 4), false)
})

test('getHistoricalRecord returns exact count and last year seen', () => {
  const record2017 = getHistoricalRecord(20, 17)
  assert.ok(record2017 !== null)
  assert.ok(record2017[0] > 200) // occurred 300+ times
  assert.ok(record2017[1] >= 2024)

  const recordNovel = getHistoricalRecord(43, 29)
  assert.equal(recordNovel, null)
})

test('getGameSecondsRemaining computes true total regulation seconds', () => {
  // Pre-game
  assert.equal(getGameSecondsRemaining({}, 'pre'), 3600)

  // Post-game
  assert.equal(getGameSecondsRemaining({}, 'post'), 0)

  // Q1 start (15:00 = 900s)
  assert.equal(getGameSecondsRemaining({ period: 1, clock: 900 }, 'in'), 3600)

  // Q2 with 0:39 left -> (4 - 2)*900 + 39 = 1839s
  assert.equal(getGameSecondsRemaining({ period: 2, clock: 39 }, 'in'), 1839)

  // Q3 start (15:00 = 900s) -> (4 - 3)*900 + 900 = 1800s
  assert.equal(getGameSecondsRemaining({ period: 3, clock: 900 }, 'in'), 1800)

  // Q4 with 2:00 left -> (4 - 4)*900 + 120 = 120s
  assert.equal(getGameSecondsRemaining({ period: 4, clock: 120 }, 'in'), 120)

  // Overtime with 8:00 left -> 480s
  assert.equal(getGameSecondsRemaining({ period: 5, clock: 480 }, 'in'), 480)
})

test('Pre-game Scorigami projection calculates realistic ~6% novelty chance and most likely score', () => {
  const pre = getScorigamiInfo(0, 0, 3600, 'pre', 'KC', 'BAL')
  assert.equal(pre.isCurrentScorigami, false)
  assert.ok(pre.chancePct > 0.04 && pre.chancePct < 0.10)
  assert.ok(pre.mostLikelyNovel !== null)
  assert.match(pre.whenScenario, /Pre-game projection: Occurs if final score reaches/)
})

test('Live game Scorigami projection accurately reports novel score needs', () => {
  // Live in Q2: DET 14, GB 9
  const live = getScorigamiInfo(14, 9, 2100, 'in', 'DET', 'GB')
  assert.equal(live.isCurrentScorigami, false)
  assert.ok(live.chancePct > 0.01)
  assert.ok(live.mostLikelyNovel !== null)
  assert.match(live.whenScenario, /When score reaches/)
  assert.match(live.whenScenario, /DET/)
  assert.match(live.whenScenario, /GB/)
})

test('Live game at a currently novel score with time expiring detects impending Scorigami', () => {
  // 25-18 with 45s left in Q4
  const liveNovel = getScorigamiInfo(25, 18, 45, 'in', 'SF', 'LAR')
  assert.equal(liveNovel.isCurrentScorigami, true)
  assert.ok(liveNovel.chancePct > 0.90) // very high probability to hold
  assert.equal(liveNovel.mostLikelyNovel, '25-18')
  assert.match(liveNovel.whenScenario, /Current score \(25-18\) is a Scorigami right now if score holds!/)
})

test('Post-game non-scorigami displays historical occurrences and last year', () => {
  const postCommon = getScorigamiInfo(20, 17, 0, 'post')
  assert.equal(postCommon.isCurrentScorigami, false)
  assert.equal(postCommon.chancePct, 0)
  assert.equal(postCommon.chanceLabel, '0% — Already Occurred')
  assert.ok(postCommon.currentOccurrences > 200)
  assert.match(postCommon.whenScenario, /Final: Occurred \d+x in NFL history/)
})

test('Post-game genuine scorigami announces historical novelty', () => {
  const postNovel = getScorigamiInfo(43, 29, 0, 'post')
  assert.equal(postNovel.isCurrentScorigami, true)
  assert.equal(postNovel.chancePct, 1)
  assert.equal(postNovel.chanceLabel, '100% — Historical Scorigami!')
  assert.equal(postNovel.mostLikelyNovel, '43-29')
  assert.match(postNovel.whenScenario, /Final: Novel score #\d+ in NFL history!/)
})
