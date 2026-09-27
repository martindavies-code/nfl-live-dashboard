import test from 'node:test'
import assert from 'node:assert/strict'
import {
  safeParseInt,
  sanitizeHexColor,
  getContrastYIQ,
  formatDownAndDistance,
  getOffensiveDrive,
} from './nflHelpers.ts'

test('safeParseInt handles numbers, strings, dashes, nulls, and undefined', () => {
  assert.equal(safeParseInt('24'), 24)
  assert.equal(safeParseInt(10), 10)
  assert.equal(safeParseInt('-'), 0)
  assert.equal(safeParseInt(''), 0)
  assert.equal(safeParseInt(null), 0)
  assert.equal(safeParseInt(undefined), 0)
  assert.equal(safeParseInt('invalid', 5), 5)
  assert.equal(Number.isFinite(safeParseInt('-')), true)
})

test('sanitizeHexColor normalizes hex codes', () => {
  assert.equal(sanitizeHexColor('00338d'), '#00338d')
  assert.equal(sanitizeHexColor('#00338d'), '#00338d')
  assert.equal(sanitizeHexColor('fff'), '#ffffff')
  assert.equal(sanitizeHexColor('#fff'), '#ffffff')
  assert.equal(sanitizeHexColor('invalid', '#1e3a8a'), '#1e3a8a')
  assert.equal(sanitizeHexColor(undefined, '#1e3a8a'), '#1e3a8a')
})

test('getContrastYIQ correctly chooses white or black text', () => {
  assert.equal(getContrastYIQ('#000000'), 'white')
  assert.equal(getContrastYIQ('#00338d'), 'white') // Bills navy
  assert.equal(getContrastYIQ('#ffffff'), 'black')
  assert.equal(getContrastYIQ('#ffb81c'), 'black') // Chiefs gold
})

test('formatDownAndDistance formats various NFL down and distance states', () => {
  assert.equal(
    formatDownAndDistance({
      down: 3,
      distance: 4,
      yardLine: 18,
      possessionText: 'BUF 18',
    }),
    '3rd & 4 at BUF 18'
  )

  assert.equal(
    formatDownAndDistance({
      down: 1,
      distance: 0,
      yardLine: 5,
      possessionText: 'BUF 5',
    }),
    '1st & Goal at BUF 5'
  )

  assert.equal(
    formatDownAndDistance({
      down: -1,
      distance: 0,
      yardLine: 0,
    }),
    'Kickoff / PAT Attempt'
  )

  assert.equal(formatDownAndDistance(null), 'Between Plays')
})

test('getOffensiveDrive accurately resolves possession and direction', () => {
  const competitors = [
    {
      id: '2',
      homeAway: 'home',
      score: '27',
      team: { id: '2', name: 'Bills', abbreviation: 'BUF', color: '00338d' },
    },
    {
      id: '12',
      homeAway: 'away',
      score: '24',
      team: { id: '12', name: 'Chiefs', abbreviation: 'KC', color: 'e31837' },
    },
  ]

  // Home possession -> driving right towards 100
  const homeDrive = getOffensiveDrive({ possession: '2' }, competitors)
  assert.equal(homeDrive.isHomePossession, true)
  assert.equal(homeDrive.isAwayPossession, false)
  assert.equal(homeDrive.direction, 'right')
  assert.equal(homeDrive.offensiveTeam.team.abbreviation, 'BUF')

  // Away possession -> driving left towards 0
  const awayDrive = getOffensiveDrive({ possession: '12' }, competitors)
  assert.equal(awayDrive.isHomePossession, false)
  assert.equal(awayDrive.isAwayPossession, true)
  assert.equal(awayDrive.direction, 'left')
  assert.equal(awayDrive.offensiveTeam.team.abbreviation, 'KC')
})
