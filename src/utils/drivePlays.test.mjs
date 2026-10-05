import test from 'node:test'
import assert from 'node:assert/strict'
import {
  categorizePlay,
  getPlayColor,
  getPlayCategoryLabel,
  parseRawESPNPlays,
  getPlayLaneY,
  generateMockDrivePlays,
  isKickoffPlay,
} from './drivePlays.ts'

test('Drive Plays: categorizePlay and getPlayCategoryLabel classify and format accurately', () => {
  assert.equal(categorizePlay('Pass Reception', 'B.Young pass to T.Tremble'), 'pass')
  assert.equal(getPlayCategoryLabel('pass'), 'Pass')
  assert.equal(categorizePlay('Pass Incompletion', 'Incomplete pass'), 'pass')
  assert.equal(categorizePlay('Rush', 'C.Hubbard up the middle'), 'run')
  assert.equal(getPlayCategoryLabel('run'), 'Run')
  assert.equal(categorizePlay('', 'J.Gibbs ran left tackle for 5 yards'), 'run')
  assert.equal(categorizePlay('Sack', 'B.Young sacked for -8 yards'), 'sack')
  assert.equal(getPlayCategoryLabel('sack'), 'Sack')
  assert.equal(categorizePlay('Penalty', 'False start on offense'), 'penalty')
  assert.equal(getPlayCategoryLabel('penalty'), 'Penalty')
  assert.equal(categorizePlay('Punt', 'S.Martin punts 44 yards'), 'kick')
  assert.equal(getPlayCategoryLabel('kick'), 'Kick')
  assert.equal(categorizePlay('Official Timeout', 'Official Timeout'), 'other')
  assert.equal(getPlayCategoryLabel('other'), 'Play')
})

test('Drive Plays: getPlayColor returns distinct visual colors for pass vs run', () => {
  const passColor = getPlayColor('pass')
  const runColor = getPlayColor('run')
  const sackColor = getPlayColor('sack')
  const penaltyColor = getPlayColor('penalty')

  assert.equal(passColor, '#38bdf8') // Electric Sky Blue
  assert.equal(runColor, '#f43f5e')  // Neon Rose
  assert.equal(sackColor, '#a855f7') // Violet
  assert.equal(penaltyColor, '#f59e0b') // Amber

  assert.notEqual(passColor, runColor)
})

test('Drive Plays: parseRawESPNPlays safely parses real and messy ESPN play payloads', () => {
  const raw = [
    {
      id: 'p1',
      type: { text: 'Pass Reception' },
      text: 'Pass 10 yards',
      statYardage: 10,
      start: { yardLine: 20, down: 1, distance: 10 },
      end: { yardLine: 30 },
    },
    {
      id: 'p2',
      type: { text: 'Rush' },
      text: 'Run 4 yards',
      statYardage: 4,
      start: { yardLine: 30, down: 1, distance: 10 },
      end: { yardLine: 34 },
    },
    // Null / empty item
    null,
    // Timeout (should be skipped)
    {
      id: 'p3',
      type: { text: 'Official Timeout' },
      text: 'Timeout',
      statYardage: 0,
    },
  ]

  const parsed = parseRawESPNPlays(raw)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].category, 'pass')
  assert.equal(parsed[0].startYardLine, 20)
  assert.equal(parsed[0].endYardLine, 30)
  assert.equal(parsed[1].category, 'run')
  assert.equal(parsed[1].startYardLine, 30)
  assert.equal(parsed[1].endYardLine, 34)
})

test('Drive Plays: parseRawESPNPlays clamps out-of-bounds coordinates to 0..100', () => {
  const raw = [
    {
      id: 'p1',
      type: { text: 'Rush' },
      text: 'Huge run',
      statYardage: 999,
      start: { yardLine: -50 },
      end: { yardLine: 999 },
    },
  ]
  const parsed = parseRawESPNPlays(raw)
  assert.equal(parsed[0].startYardLine, 0)
  assert.equal(parsed[0].endYardLine, 100)
})

test('Drive Plays: getPlayLaneY provides clean non-colliding staggered lanes', () => {
  const y0 = getPlayLaneY(0, 5)
  const y1 = getPlayLaneY(1, 5)
  const y2 = getPlayLaneY(2, 5)
  assert.notEqual(y0, y1)
  assert.notEqual(y1, y2)
  assert.ok(y0 >= 80 && y0 <= 320)
  assert.ok(y1 >= 80 && y1 <= 320)
})

test('Drive Plays: generateMockDrivePlays generates valid sequential plays', () => {
  const playsRight = generateMockDrivePlays(45, 'right', 'CAR')
  assert.ok(playsRight.length >= 3)
  assert.equal(playsRight[playsRight.length - 1].endYardLine, 45)
  assert.ok(playsRight.some((p) => p.category === 'pass'))
  assert.ok(playsRight.some((p) => p.category === 'run'))

  const playsLeft = generateMockDrivePlays(45, 'left', 'DET')
  assert.ok(playsLeft.length >= 3)
  assert.equal(playsLeft[playsLeft.length - 1].endYardLine, 45)
})

test('Drive Plays: isKickoffPlay accurately detects kickoff events and avoids false positives', () => {
  // Explicit kickoff types
  assert.equal(isKickoffPlay({ type: { text: 'Kickoff' } }), true)
  assert.equal(isKickoffPlay({ type: { text: 'Kickoff Return' } }), true)
  assert.equal(isKickoffPlay({ type: { text: 'Onside Kickoff' } }), true)
  assert.equal(isKickoffPlay({ type: { abbreviation: 'KO' } }), true)
  assert.equal(isKickoffPlay({ type: { id: 53 } }), true)
  assert.equal(isKickoffPlay({ type: { id: '52' } }), true)

  // Kickoff play text phrasing
  assert.equal(
    isKickoffPlay({ text: 'H.Butker kicks 65 yards from KC 35 to the End Zone. Touchback.' }),
    true
  )
  assert.equal(
    isKickoffPlay({ text: 'J.Moody kicks 65 yards from SF 35 to MIA 0. M.Washington to MIA 28 for 28 yards.' }),
    true
  )
  assert.equal(
    isKickoffPlay({ text: 'C.Santos kicks off 65 yards to GB End Zone' }),
    true
  )
  assert.equal(
    isKickoffPlay({ text: 'Onside kick by PIT recovered by CLE' }),
    true
  )

  // False positive checks: Punts, Field Goals, PATs, and regular plays must NEVER be flagged as kickoffs
  assert.equal(
    isKickoffPlay({ type: { text: 'Punt' }, text: 'T.Townsend punts 52 yards to KC 18', start: { down: 4 } }),
    false
  )
  assert.equal(
    isKickoffPlay({ type: { text: 'Field Goal Good' }, text: 'H.Butker 48 yard field goal is GOOD', start: { down: 4 } }),
    false
  )
  assert.equal(
    isKickoffPlay({ type: { text: 'Extra Point Good' }, text: 'H.Butker extra point is GOOD', start: { down: -1 } }),
    false
  )
  assert.equal(
    isKickoffPlay({ type: { text: 'Rush' }, text: 'I.Pacheco up the middle for 5 yards', start: { down: 1 } }),
    false
  )
  assert.equal(
    isKickoffPlay({ type: { text: 'Pass Reception' }, text: 'P.Mahomes pass to T.Kelce for 12 yards', start: { down: 2 } }),
    false
  )
})

test('Drive Plays: parseRawESPNPlays strictly EXCLUDES kickoff as the first play of a drive', () => {
  const rawDrivePlaysWithKickoff = [
    // Play 0: Kickoff that initiated the drive in ESPN's feed
    {
      id: 'kickoff-0',
      type: { text: 'Kickoff', abbreviation: 'KO' },
      text: 'H.Butker kicks 65 yards from KC 35 to the end zone. Touchback.',
      statYardage: 0,
      start: { yardLine: 35, down: -1 },
      end: { yardLine: 70 },
    },
    // Play 1: The actual first play from scrimmage of the offensive drive
    {
      id: 'scrimmage-1',
      type: { text: 'Pass Reception' },
      text: 'P.Mahomes pass short right to R.Rice to KC 34 for 9 yards.',
      statYardage: 9,
      start: { yardLine: 25, down: 1, distance: 10 },
      end: { yardLine: 34 },
    },
    // Play 2: Second play from scrimmage
    {
      id: 'scrimmage-2',
      type: { text: 'Rush' },
      text: 'I.Pacheco up the middle for 6 yards. 1ST DOWN!',
      statYardage: 6,
      start: { yardLine: 34, down: 2, distance: 1 },
      end: { yardLine: 40 },
    },
  ]

  const parsed = parseRawESPNPlays(rawDrivePlaysWithKickoff)

  // Kickoff must NOT be included as the first play!
  assert.equal(parsed.length, 2, 'Must have exactly 2 offensive plays, omitting the kickoff')
  assert.equal(parsed[0].id, 'scrimmage-1')
  assert.equal(parsed[0].sequence, 1, 'First offensive play must be sequenced as play #1')
  assert.equal(parsed[0].category, 'pass')
  assert.equal(parsed[0].startYardLine, 25)
  assert.equal(parsed[0].endYardLine, 34)

  assert.equal(parsed[1].id, 'scrimmage-2')
  assert.equal(parsed[1].sequence, 2, 'Second offensive play must be sequenced as play #2')
  assert.equal(parsed[1].category, 'run')
})

