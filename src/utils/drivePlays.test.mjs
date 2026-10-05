import test from 'node:test'
import assert from 'node:assert/strict'
import {
  categorizePlay,
  getPlayColor,
  getPlayCategoryLabel,
  parseRawESPNPlays,
  getPlayLaneY,
  generateMockDrivePlays,
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
