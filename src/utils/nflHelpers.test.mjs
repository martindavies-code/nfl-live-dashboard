import test from 'node:test'
import assert from 'node:assert/strict'
import {
  safeParseInt,
  sanitizeHexColor,
  getContrastYIQ,
  formatDownAndDistance,
  getOffensiveDrive,
  isRedZoneSituation,
  isHalftimeSituation,
  areColorsTooSimilar,
  resolveContrastingTeamColors,
  getWeekLabel,
  getWeekBadgeText,
  getSeasonPhaseDescription,
  getNextWeek,
  getPrevWeek,
  PLAYOFF_ROUNDS,
  REGULAR_SEASON_WEEKS,
  sanitizePatriotsName,
  sanitizePatriotsInEvent,
  sanitizePatriotsInScoreboardData,
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

test('isHalftimeSituation accurately identifies Halftime states', () => {
  // 1. Explicit STATUS_HALFTIME
  assert.equal(
    isHalftimeSituation({
      clock: 0,
      period: 2,
      type: { state: 'in', name: 'STATUS_HALFTIME', detail: 'Halftime' },
    }),
    true
  )

  // 2. Detail is Halftime
  assert.equal(
    isHalftimeSituation({
      clock: 0,
      period: 2,
      type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: 'Halftime' },
    }),
    true
  )

  // 3. Quarter 2 at 0:00 (exact screenshot case)
  assert.equal(
    isHalftimeSituation(
      {
        clock: 0,
        displayClock: '0:00',
        period: 2,
        type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: '0:00 - 2nd Quarter' },
      },
      {
        lastPlay: { text: 'END QUARTER 2' },
      }
    ),
    true
  )

  // 4. Active 2nd quarter play (4:30 remaining) -> NOT Halftime
  assert.equal(
    isHalftimeSituation({
      clock: 270,
      displayClock: '4:30',
      period: 2,
      type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: '4:30 - 2nd Quarter' },
    }),
    false
  )

  // 5. End of 1st Quarter (clock 0:00, period 1) -> NOT Halftime
  assert.equal(
    isHalftimeSituation({
      clock: 0,
      displayClock: '0:00',
      period: 1,
      type: { state: 'in', name: 'STATUS_END_PERIOD', detail: 'End of 1st Quarter' },
    }),
    false
  )

  // 6. Final game -> NOT Halftime
  assert.equal(
    isHalftimeSituation({
      clock: 0,
      period: 4,
      type: { state: 'post', completed: true, name: 'STATUS_FINAL', detail: 'Final' },
    }),
    false
  )

  // 7. Pregame -> NOT Halftime
  assert.equal(
    isHalftimeSituation({
      clock: 900,
      period: 1,
      type: { state: 'pre', completed: false, name: 'STATUS_SCHEDULED', detail: 'Scheduled' },
    }),
    false
  )
})

test('areColorsTooSimilar accurately detects clashing vs distinct team colors', () => {
  // Identical colors
  assert.equal(areColorsTooSimilar('#00338d', '#00338d'), true)

  // Bills blue vs Patriots/Cowboys deep navy (similar blue hue and low Delta E)
  assert.equal(areColorsTooSimilar('#00338d', '#0b2265'), true)

  // Two dark colors (Steelers black vs Panthers black/dark)
  assert.equal(areColorsTooSimilar('#101820', '#000000'), true)

  // Distinct contrast (Bills blue vs Chiefs red)
  assert.equal(areColorsTooSimilar('#00338d', '#e31837'), false)

  // Distinct contrast (Packers green vs Vikings purple)
  assert.equal(areColorsTooSimilar('#203731', '#4f2683'), false)
})

test('resolveContrastingTeamColors ensures distinct broadcast contrast', () => {
  // 1. Naturally distinct teams: Bills (Blue) vs Chiefs (Red)
  const distinct = resolveContrastingTeamColors(
    { team: { color: '00338d', alternateColor: 'c60c30' } },
    { team: { color: 'e31837', alternateColor: 'ffb81c' } }
  )
  assert.equal(distinct.homeColor, '#00338d')
  assert.equal(distinct.awayColor, '#e31837')

  // 2. Clashing blue teams: Bills (Navy) vs Cowboys (Navy), Cowboys have silver alternate
  const blueClash = resolveContrastingTeamColors(
    { team: { color: '00338d', alternateColor: 'c60c30' } },
    { team: { color: '002244', alternateColor: '869397' } }
  )
  assert.equal(blueClash.homeColor, '#00338d')
  assert.notEqual(blueClash.awayColor, '#002244') // Must have changed to alternate or fallback
  assert.equal(areColorsTooSimilar(blueClash.homeColor, blueClash.awayColor), false)

  // 3. Clashing colors with no alternates: Falls back to curated contrasting pair
  const darkClashNoAlt = resolveContrastingTeamColors(
    { team: { color: '001122' } },
    { team: { color: '001133' } }
  )
  assert.equal(areColorsTooSimilar(darkClashNoAlt.homeColor, darkClashNoAlt.awayColor), false)
})

test('getWeekLabel formats regular season, preseason, and all 5 playoff rounds correctly', () => {
  // Regular season
  assert.equal(getWeekLabel(2, 1), 'Week 1')
  assert.equal(getWeekLabel(2, 4), 'Week 4')
  assert.equal(getWeekLabel(2, 18), 'Week 18')
  assert.equal(getWeekLabel(undefined, 4), 'Week 4')

  // Preseason
  assert.equal(getWeekLabel(1, 1), 'Preseason Week 1')
  assert.equal(getWeekLabel(1, 3), 'Preseason Week 3')

  // Postseason / Playoffs
  assert.equal(getWeekLabel(3, 1), 'Wild Card Weekend')
  assert.equal(getWeekLabel(3, 2), 'Divisional Round')
  assert.equal(getWeekLabel(3, 3), 'Conference Championships')
  assert.equal(getWeekLabel(3, 4), 'Pro Bowl Games')
  assert.equal(getWeekLabel(3, 5), 'Super Bowl LXI')
  assert.equal(getWeekLabel(3, 99), 'Playoff Round 99')
})

test('getWeekBadgeText provides sleek compact labels for headers and buttons', () => {
  assert.equal(getWeekBadgeText(2, 4), 'W4')
  assert.equal(getWeekBadgeText(2, 18), 'W18')
  assert.equal(getWeekBadgeText(1, 2), 'Pre W2')
  assert.equal(getWeekBadgeText(3, 1), 'Wild Card')
  assert.equal(getWeekBadgeText(3, 2), 'Divisional')
  assert.equal(getWeekBadgeText(3, 3), 'Conf Champ')
  assert.equal(getWeekBadgeText(3, 4), 'Pro Bowl')
  assert.equal(getWeekBadgeText(3, 5), 'Super Bowl')
})

test('getSeasonPhaseDescription accurately contextualizes regular season and playoff rounds', () => {
  assert.equal(
    getSeasonPhaseDescription(2, 2026, 4),
    '2026 Regular Season • Week 4'
  )
  assert.equal(
    getSeasonPhaseDescription(3, 2026, 5),
    '2026 NFL Playoffs • Super Bowl LXI'
  )
  assert.equal(
    getSeasonPhaseDescription(3, 2026, 1),
    '2026 NFL Playoffs • Wild Card Weekend'
  )
  assert.equal(
    getSeasonPhaseDescription(1, 2026, 2),
    '2026 NFL Preseason • Week 2'
  )
})

test('getNextWeek and getPrevWeek handle seamless navigation and cross-season boundaries', () => {
  // Step within regular season
  assert.deepEqual(getNextWeek(2, 3), { seasonType: 2, weekNumber: 4 })
  assert.deepEqual(getPrevWeek(2, 4), { seasonType: 2, weekNumber: 3 })

  // Boundary: Week 18 -> Wild Card Weekend (Playoffs Round 1)
  assert.deepEqual(getNextWeek(2, 18), { seasonType: 3, weekNumber: 1 })

  // Boundary: Wild Card Weekend (Playoffs Round 1) -> Week 18 (Regular Season)
  assert.deepEqual(getPrevWeek(3, 1), { seasonType: 2, weekNumber: 18 })

  // Within Playoffs: Wild Card -> Divisional -> Conf Champ -> Pro Bowl -> Super Bowl
  assert.deepEqual(getNextWeek(3, 1), { seasonType: 3, weekNumber: 2 })
  assert.deepEqual(getNextWeek(3, 2), { seasonType: 3, weekNumber: 3 })
  assert.deepEqual(getNextWeek(3, 3), { seasonType: 3, weekNumber: 4 })
  assert.deepEqual(getNextWeek(3, 4), { seasonType: 3, weekNumber: 5 })
  // Clamp at Super Bowl
  assert.deepEqual(getNextWeek(3, 5), { seasonType: 3, weekNumber: 5 })

  // Step backwards from Super Bowl
  assert.deepEqual(getPrevWeek(3, 5), { seasonType: 3, weekNumber: 4 })
  assert.deepEqual(getPrevWeek(3, 2), { seasonType: 3, weekNumber: 1 })

  // Clamp at Week 1
  assert.deepEqual(getPrevWeek(2, 1), { seasonType: 2, weekNumber: 1 })
})

test('PLAYOFF_ROUNDS and REGULAR_SEASON_WEEKS have correct NFL constants', () => {
  assert.equal(PLAYOFF_ROUNDS.length, 5)
  assert.equal(PLAYOFF_ROUNDS[0].name, 'Wild Card Weekend')
  assert.equal(PLAYOFF_ROUNDS[4].name, 'Super Bowl LXI')
  assert.equal(REGULAR_SEASON_WEEKS.length, 18)
  assert.equal(REGULAR_SEASON_WEEKS[0], 1)
  assert.equal(REGULAR_SEASON_WEEKS[17], 18)
})

test('sanitizePatriotsName always refers to New England Patriots as Fucking New England Patriots, Fucking Patriots, or Fucking Pats', () => {
  assert.equal(sanitizePatriotsName('New England Patriots'), 'Fucking New England Patriots')
  assert.equal(sanitizePatriotsName('the New England Patriots'), 'the Fucking New England Patriots')
  assert.equal(sanitizePatriotsName('New ENgland Patriots'), 'Fucking New ENgland Patriots')
  assert.equal(sanitizePatriotsName('the New ENgland Patriots'), 'the Fucking New ENgland Patriots')
  assert.equal(sanitizePatriotsName('Patriots'), 'Fucking Patriots')
  assert.equal(sanitizePatriotsName('the Patriots'), 'the Fucking Patriots')
  assert.equal(sanitizePatriotsName('Pats'), 'Fucking Pats')
  assert.equal(sanitizePatriotsName('the Pats'), 'the Fucking Pats')
  assert.equal(sanitizePatriotsName('New England Patriots at Buffalo Bills'), 'Fucking New England Patriots at Buffalo Bills')
  assert.equal(sanitizePatriotsName('Bills at Patriots'), 'Bills at Fucking Patriots')

  // Never double-prefix if already formatted
  assert.equal(sanitizePatriotsName('Fucking New England Patriots'), 'Fucking New England Patriots')
  assert.equal(sanitizePatriotsName('Fucking Patriots'), 'Fucking Patriots')
  assert.equal(sanitizePatriotsName('Fucking Pats'), 'Fucking Pats')

  // Unrelated teams remain untouched
  assert.equal(sanitizePatriotsName('Kansas City Chiefs'), 'Kansas City Chiefs')
  assert.equal(sanitizePatriotsName('Philadelphia Eagles'), 'Philadelphia Eagles')
})

test('sanitizePatriotsInEvent and sanitizePatriotsInScoreboardData sanitize all competitor team fields', () => {
  const rawEvent = {
    id: 'test-ne-1',
    name: 'New England Patriots at Miami Dolphins',
    shortName: 'NE @ MIA',
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            team: {
              id: '15',
              displayName: 'Miami Dolphins',
              name: 'Dolphins',
              abbreviation: 'MIA',
            },
          },
          {
            homeAway: 'away',
            team: {
              id: '17',
              displayName: 'New England Patriots',
              name: 'Patriots',
              shortDisplayName: 'Pats',
              nickname: 'Patriots',
              abbreviation: 'NE',
            },
          },
        ],
      },
    ],
  }

  const sanitized = sanitizePatriotsInEvent(rawEvent)
  assert.equal(sanitized.name, 'Fucking New England Patriots at Miami Dolphins')
  const pats = sanitized.competitions[0].competitors[1].team
  assert.equal(pats.displayName, 'Fucking New England Patriots')
  assert.equal(pats.name, 'Fucking Patriots')
  assert.equal(pats.shortDisplayName, 'Fucking Pats')
  assert.equal(pats.nickname, 'Fucking Patriots')

  const scoreboardData = {
    events: [rawEvent],
  }
  const cleanScoreboard = sanitizePatriotsInScoreboardData(scoreboardData)
  assert.equal(cleanScoreboard.events[0].competitions[0].competitors[1].team.displayName, 'Fucking New England Patriots')
})



