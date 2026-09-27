import test from 'node:test'
import assert from 'node:assert/strict'
import {
  safeParseInt,
  sanitizeHexColor,
  getContrastYIQ,
  formatDownAndDistance,
  getOffensiveDrive,
  isRedZoneSituation,
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

test('isRedZoneSituation rejects Halftime and End of Quarter even if ESPN flags isRedZone', () => {
  const competitors = [
    {
      id: '5',
      homeAway: 'home',
      score: '10',
      team: { id: '5', name: 'Browns', abbreviation: 'CLE' },
    },
    {
      id: '29',
      homeAway: 'away',
      score: '3',
      team: { id: '29', name: 'Panthers', abbreviation: 'CAR' },
    },
  ]

  // Exact screenshot state: Halftime, CLE at own 17, clock 0:00
  const halftimeStatus = {
    clock: 0,
    displayClock: '0:00',
    period: 2,
    type: {
      id: '1',
      name: 'STATUS_HALFTIME',
      state: 'in',
      completed: false,
      detail: 'Halftime',
      shortDetail: 'Halftime',
    },
  }

  const clevelandOwn17Situation = {
    down: 1,
    distance: 11,
    yardLine: 17,
    possession: '5',
    isRedZone: true, // Erroneous sticky flag from ESPN
    possessionText: 'CLE 17',
    lastPlay: {
      text: 'END QUARTER 2',
    },
  }

  assert.equal(
    isRedZoneSituation(clevelandOwn17Situation, halftimeStatus, competitors),
    false,
    'Must NOT be considered red zone at Halftime'
  )
})

test('isRedZoneSituation rejects own territory even during active 2nd quarter play', () => {
  const competitors = [
    {
      id: '5',
      homeAway: 'home',
      score: '10',
      team: { id: '5', name: 'Browns', abbreviation: 'CLE' },
    },
    {
      id: '29',
      homeAway: 'away',
      score: '3',
      team: { id: '29', name: 'Panthers', abbreviation: 'CAR' },
    },
  ]

  // Live in progress: 4:30 in 2nd quarter
  const activeStatus = {
    clock: 270,
    displayClock: '4:30',
    period: 2,
    type: {
      id: '2',
      name: 'STATUS_IN_PROGRESS',
      state: 'in',
      completed: false,
      detail: '4:30 - 2nd Quarter',
    },
  }

  // Cleveland driving right at own 17 (83 yards from Carolina goal)
  const clevelandOwn17 = {
    down: 1,
    distance: 10,
    yardLine: 17,
    possession: '5',
    isRedZone: true, // Erroneous sticky flag from ESPN
    possessionText: 'CLE 17',
  }

  assert.equal(
    isRedZoneSituation(clevelandOwn17, activeStatus, competitors),
    false,
    'Must NOT be considered red zone when offense is at own 17'
  )

  // Carolina driving left at own 18 (yardLine = 82 in ESPN coords, 82 yards from goal)
  const carolinaOwn18 = {
    down: 1,
    distance: 10,
    yardLine: 82,
    possession: '29',
    isRedZone: true,
    possessionText: 'CAR 18',
  }

  assert.equal(
    isRedZoneSituation(carolinaOwn18, activeStatus, competitors),
    false,
    'Must NOT be considered red zone when away team is at own 18'
  )
})

test('isRedZoneSituation rejects dead-ball plays like kickoffs and PATs', () => {
  const competitors = [
    { id: '2', homeAway: 'home', team: { id: '2', abbreviation: 'BUF' } },
    { id: '12', homeAway: 'away', team: { id: '12', abbreviation: 'KC' } },
  ]
  const liveStatus = {
    clock: 600,
    period: 3,
    type: { state: 'in', name: 'STATUS_IN_PROGRESS' },
  }

  // Kickoff (down: -1)
  assert.equal(
    isRedZoneSituation(
      { down: -1, yardLine: 65, isRedZone: true },
      liveStatus,
      competitors
    ),
    false,
    'Kickoff must not be red zone'
  )

  // PAT attempt (down: 0)
  assert.equal(
    isRedZoneSituation(
      { down: 0, yardLine: 15, isRedZone: true },
      liveStatus,
      competitors
    ),
    false,
    'PAT must not be red zone'
  )
})

test('isRedZoneSituation correctly confirms genuine Red Zone situations', () => {
  const competitors = [
    { id: '5', homeAway: 'home', team: { id: '5', abbreviation: 'CLE' } },
    { id: '29', homeAway: 'away', team: { id: '29', abbreviation: 'CAR' } },
  ]
  const liveStatus = {
    clock: 120,
    period: 4,
    type: { state: 'in', name: 'STATUS_IN_PROGRESS' },
  }

  // Home (CLE) driving right towards CAR goal (100) at yardLine 88 (12 yards from goal)
  assert.equal(
    isRedZoneSituation(
      { down: 1, distance: 10, yardLine: 88, possession: '5', possessionText: 'CAR 12' },
      liveStatus,
      competitors
    ),
    true,
    'Home team at opponent 12 yard line MUST be recognized as red zone'
  )

  // Away (CAR) driving left towards CLE goal (0) at yardLine 15 (15 yards from goal)
  assert.equal(
    isRedZoneSituation(
      { down: 2, distance: 4, yardLine: 15, possession: '29', possessionText: 'CLE 15' },
      liveStatus,
      competitors
    ),
    true,
    'Away team at opponent 15 yard line MUST be recognized as red zone'
  )
})

