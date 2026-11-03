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
  // Bug 2: Pre-game must NEVER associate 0-0's 1943 history with an unplayed matchup
  assert.equal(pre.lastGameSummary, null, 'Pre-game must not show 0-0 historical summary')
  assert.equal(pre.currentOccurrences, 0, 'Pre-game currentOccurrences must be 0')
  assert.equal(pre.lastSeenYear, null, 'Pre-game lastSeenYear must be null')
})

test('Pre-game Scorigami projection scales with game total (Over/Under) and spread', () => {
  // 1. Missing / null odds falls back cleanly to baseline
  const preBaseline = getScorigamiInfo(0, 0, 3600, 'pre', 'CIN', 'ATL', null)
  assert.ok(preBaseline.mostLikelyNovel !== null)

  // 2. Low-scoring game total (O/U 35.0) vs High-scoring game total (O/U 56.0)
  const lowTotal = getScorigamiInfo(0, 0, 3600, 'pre', 'CHI', 'MIN', { overUnder: 35.0, spread: 0 })
  const highTotal = getScorigamiInfo(0, 0, 3600, 'pre', 'MIA', 'BUF', { overUnder: 56.0, spread: 0 })

  assert.ok(lowTotal.mostLikelyNovel !== null)
  assert.ok(highTotal.mostLikelyNovel !== null)

  const [lowHi, lowLo] = (lowTotal.mostLikelyNovel || '0-0').split('-').map(Number)
  const [highHi, highLo] = (highTotal.mostLikelyNovel || '0-0').split('-').map(Number)

  // High total matchup must project higher total points than low total matchup
  assert.ok(
    highHi + highLo > lowHi + lowLo,
    `High total projected score (${highTotal.mostLikelyNovel}) must exceed low total projected score (${lowTotal.mostLikelyNovel})`
  )

  // 3. Heavy favorite spread (Home favored by 14 points vs Even spread)
  const heavyFav = getScorigamiInfo(0, 0, 3600, 'pre', 'KC', 'CAR', { overUnder: 48.0, spread: -14.0 })
  assert.ok(heavyFav.mostLikelyNovel !== null)

  // 4. Over/Under passed as string or object with overUnderValue
  const stringTotal = getScorigamiInfo(0, 0, 3600, 'pre', 'KC', 'CAR', { overUnder: '48.5', spread: -3.5 })
  assert.ok(stringTotal.mostLikelyNovel !== null)
  const valueTotal = getScorigamiInfo(0, 0, 3600, 'pre', 'KC', 'CAR', { overUnderValue: 48.5, spreadValue: -3.5 })
  assert.equal(stringTotal.mostLikelyNovel, valueTotal.mostLikelyNovel)
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

test('Historic outlier scores and defensive resilience in Scorigami engine', () => {
  // 73-0 (1940 NFL Championship Game) occurred
  assert.equal(hasOccurred(73, 0), true)
  const rec73 = getHistoricalRecord(73, 0)
  assert.ok(rec73 !== null)
  assert.equal(rec73[1], 1940)
  assert.equal(rec73[2], '1940-12-08')
  assert.equal(rec73[3], 'Chicago Bears')
  assert.equal(rec73[4], 'Washington Redskins')

  // 70-20 (Dolphins vs Broncos 2023) occurred
  assert.equal(hasOccurred(70, 20), true)
  const rec70 = getHistoricalRecord(70, 20)
  assert.ok(rec70 !== null)
  assert.equal(rec70[1], 2023)
  assert.equal(rec70[2], '2023-09-24')
  assert.equal(rec70[3], 'Miami Dolphins')
  assert.equal(rec70[4], 'Denver Broncos')

  // 2-0 safety game occurred
  assert.equal(hasOccurred(2, 0), true)

  // Defensive input handling: negative numbers and NaN do not throw
  const nanRes = getScorigamiInfo(NaN, -10, -500, 'in')
  assert.ok(nanRes)
  assert.ok(Number.isFinite(nanRes.chancePct))
  assert.ok(nanRes.chanceLabel.length > 0)
})

test('Post-game non-scorigami displays exact last game matchup and date', () => {
  const postCommon = getScorigamiInfo(20, 17, 0, 'post')
  assert.equal(postCommon.isCurrentScorigami, false)
  assert.ok(postCommon.lastDate !== null)
  assert.ok(postCommon.lastWinner !== null)
  assert.ok(postCommon.lastLoser !== null)
  assert.ok(postCommon.lastGameSummary !== null)
  assert.equal(postCommon.lastDateIso, '2026-09-20')
  assert.equal(postCommon.lastDate, 'Sep 20, 2026')
  assert.equal(postCommon.lastWinner, 'Green Bay Packers')
  assert.equal(postCommon.lastLoser, 'New York Jets')
  assert.equal(postCommon.lastGameSummary, 'Green Bay Packers 20, New York Jets 17 on Sep 20, 2026')
  assert.match(postCommon.whenScenario, /Green Bay Packers 20, New York Jets 17 on Sep 20, 2026/)
})


