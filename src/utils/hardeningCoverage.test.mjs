import test from 'node:test'
import assert from 'node:assert/strict'

// 1. AudioFeedback Web Audio Synthesis Testing
test('audioFeedback runs through AudioContext synthesis without errors and handles throttling', async () => {
  const { playRedZoneSound, playScoreChime, playTactileClick } = await import('./audioFeedback.ts')

  // When muted, operations return immediately without touching audio context
  playRedZoneSound(true)
  playScoreChime(true)
  playTactileClick(true)

  // In Node.js environment without window, safely returns without crashing
  playRedZoneSound(false)
  playScoreChime(false)
  playTactileClick(false)

  // Mock a complete Web Audio API context in globalThis.window
  const originalWindow = globalThis.window

  class MockParam {
    constructor() {
      this.value = 0
    }
    setValueAtTime(val) {
      this.value = val
    }
    exponentialRampToValueAtTime(val) {
      this.value = val
    }
  }

  class MockGainNode {
    constructor() {
      this.gain = new MockParam()
    }
    connect() {}
    disconnect() {}
  }

  class MockOscillatorNode {
    constructor() {
      this.frequency = new MockParam()
      this.type = 'sine'
      this.onended = null
    }
    connect() {}
    disconnect() {}
    start() {}
    stop() {
      if (this.onended) this.onended()
    }
  }

  class MockAudioContext {
    constructor() {
      this.state = 'suspended'
      this.currentTime = 0
      this.destination = {}
    }
    createGain() {
      return new MockGainNode()
    }
    createOscillator() {
      return new MockOscillatorNode()
    }
    async resume() {
      this.state = 'running'
    }
    async close() {
      this.state = 'closed'
    }
  }

  try {
    globalThis.window = {
      AudioContext: MockAudioContext,
    }

    // Trigger each synthesized tone
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)

    // Trigger multiple times to test concurrent node limiting
    for (let i = 0; i < 20; i++) {
      playRedZoneSound(false)
    }

    // Test webkitAudioContext fallback
    globalThis.window = {
      webkitAudioContext: MockAudioContext,
    }
    playRedZoneSound(false)

    // Test error throwing inside synthesis nodes to trigger catch blocks (lines 96, 129, 159)
    class ThrowingAudioContext extends MockAudioContext {
      createOscillator() {
        const osc = super.createOscillator()
        osc.start = () => {
          throw new Error('Autoplay blocked')
        }
        return osc
      }
    }
    globalThis.window = {
      AudioContext: ThrowingAudioContext,
    }
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)

    // Test exception handling in audio context creation
    class BrokenAudioContext {
      constructor() {
        throw new Error('Web Audio not allowed')
      }
    }
    globalThis.window = {
      AudioContext: BrokenAudioContext,
    }
    playRedZoneSound(false)
  } finally {
    globalThis.window = originalWindow
  }
})

// 2. PowerRankings Matchup Resolution Testing
test('powerRankings handles slates with only post games, only halftime games, or empty events', async () => {
  const { getBestMatchupByPowerRanking, getEventKickoffMs } = await import('./powerRankings.ts')

  // Empty events returns null safely
  assert.equal(getBestMatchupByPowerRanking([]), null)

  // getEventKickoffMs edge cases
  assert.equal(getEventKickoffMs({}), Infinity)
  assert.equal(getEventKickoffMs({ date: 'invalid-date' }), Infinity)

  // Slate with only completed games (state = 'post')
  const completedSlate = [
    {
      id: 'post-1',
      name: 'Team A at Team B',
      status: { type: { state: 'post' } },
      competitions: [
        {
          competitors: [
            { id: '1', homeAway: 'home', team: { abbreviation: 'KC', displayName: 'Kansas City Chiefs' } },
            { id: '2', homeAway: 'away', team: { abbreviation: 'BUF', displayName: 'Buffalo Bills' } },
          ],
        },
      ],
    },
    {
      id: 'post-2',
      name: 'Team C at Team D',
      status: { type: { state: 'post' } },
      competitions: [
        {
          competitors: [
            { id: '3', homeAway: 'home', team: { abbreviation: 'CAR', displayName: 'Carolina Panthers' } },
            { id: '4', homeAway: 'away', team: { abbreviation: 'CLE', displayName: 'Cleveland Browns' } },
          ],
        },
      ],
    },
  ]

  const spotlightPost = getBestMatchupByPowerRanking(completedSlate)
  assert.ok(spotlightPost)
  // KC vs BUF should be ranked higher than CAR vs CLE
  assert.equal(spotlightPost.id, 'post-1')

  // Slate with only Halftime games
  const halftimeSlate = [
    {
      id: 'ht-1',
      name: 'Team E at Team F',
      status: {
        type: { state: 'in', detail: 'Halftime' },
        period: 2,
        clock: 0,
      },
      competitions: [
        {
          competitors: [
            { id: '5', homeAway: 'home', team: { abbreviation: 'PHI', displayName: 'Philadelphia Eagles' } },
            { id: '6', homeAway: 'away', team: { abbreviation: 'BAL', displayName: 'Baltimore Ravens' } },
          ],
        },
      ],
    },
  ]

  const spotlightHt = getBestMatchupByPowerRanking(halftimeSlate)
  assert.ok(spotlightHt)
  assert.equal(spotlightHt.id, 'ht-1')

  // Pre-game games with non-finite kickoff time
  const preInvalidDates = [
    {
      id: 'pre-inv-1',
      name: 'Team A vs Team B',
      date: 'invalid-date',
      status: { type: { state: 'pre' } },
      competitions: [],
    },
  ]
  const spotlightPreInv = getBestMatchupByPowerRanking(preInvalidDates)
  assert.equal(spotlightPreInv?.id, 'pre-inv-1')

  // Fallback branch: games with unrecognized state (neither in, pre, nor post)
  const unknownSlate = [
    {
      id: 'unknown-1',
      name: 'Team X at Team Y',
      status: { type: { state: 'delayed' } },
      competitions: [],
    },
  ]
  const spotlightUnknown = getBestMatchupByPowerRanking(unknownSlate)
  assert.equal(spotlightUnknown?.id, 'unknown-1')
})

// 3. BroadcastInfo Network & Window Mapping Testing
test('broadcastInfo maps all US networks, UK channels, London venues, and Super Bowl accurately', async () => {
  const { getGameBroadcastDetails, getVerifiedAnnouncers } = await import('./broadcastInfo.ts')

  // getVerifiedAnnouncers direct branch coverage (without context)
  const verifiedDirectEvent = {
    date: '2026-10-04T13:30:00Z',
    season: { type: 2 },
    week: { number: 4 },
    competitions: [
      {
        broadcasts: [{ names: ['NFL Network'] }],
        venue: { fullName: 'Tottenham Hotspur Stadium', address: { city: 'London' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'WSH' } },
          { homeAway: 'away', team: { abbreviation: 'IND' } },
        ],
      },
    ],
  }
  const verifiedRes = getVerifiedAnnouncers(verifiedDirectEvent)
  assert.ok(verifiedRes.announcers.verified)

  // Call getVerifiedAnnouncers with an unverified game and null context to test derivation
  const unverifiedSunEvent = {
    date: '2026-10-04T17:00:00Z',
    competitions: [
      {
        broadcasts: [{ names: ['FOX'] }],
        venue: { fullName: 'Wembley Stadium', address: { city: 'London' } },
      },
    ],
  }
  const unverifiedRes = getVerifiedAnnouncers(unverifiedSunEvent)
  assert.equal(unverifiedRes.announcers.verified, false)

  // Super Bowl via season type 3 and week 5
  const sbEvent = {
    season: { type: 3 },
    week: { number: 5 },
    name: 'Super Bowl LXI: Chiefs vs Eagles',
    date: '2027-02-14T23:30:00Z',
    competitions: [
      {
        broadcasts: [{ names: ['CBS'] }],
        venue: { fullName: 'SoFi Stadium', address: { city: 'Inglewood' } },
      },
    ],
  }
  const sbInfo = getGameBroadcastDetails(sbEvent)
  assert.ok(sbInfo.ukTv.includes('Channel 5 (Free-to-Air)'))

  // London venue (Tottenham Hotspur Stadium)
  const londonEvent = {
    date: '2026-10-11T13:30:00Z',
    competitions: [
      {
        broadcasts: [{ names: ['NFL Network'] }],
        venue: { fullName: 'Tottenham Hotspur Stadium', address: { city: 'London' } },
      },
    ],
  }
  const londonInfo = getGameBroadcastDetails(londonEvent)
  assert.ok(londonInfo.ukTv.includes('Channel 5'))

  // Specific US Networks
  const networksToTest = [
    { name: 'NBC', expectedUS: 'NBC' },
    { name: 'PRIME', expectedUS: 'Amazon Prime Video' },
    { name: 'Amazon Prime Video', expectedUS: 'Amazon Prime Video' },
    { name: 'ESPN / ABC', expectedUS: 'ESPN / ABC' },
    { name: 'Netflix', expectedUS: 'Netflix' },
    { name: 'Peacock', expectedUS: 'Peacock' },
    { name: 'NFL Network', expectedUS: 'NFL Network' },
  ]

  for (const item of networksToTest) {
    const ev = {
      date: '2026-10-18T18:00:00Z',
      competitions: [{ broadcasts: [{ names: [item.name] }] }],
    }
    const info = getGameBroadcastDetails(ev)
    assert.equal(info.usTv, item.expectedUS)
    assert.ok(info.ukTv.length > 0)
  }

  // Unspecified network fallbacks based on date in London timezone
  // Thursday night slot: 2026-10-08T23:15:00Z
  const thuEvent = {
    date: '2026-10-08T23:15:00Z',
    competitions: [{ broadcasts: [] }],
  }
  const thuInfo = getGameBroadcastDetails(thuEvent)
  assert.equal(thuInfo.usTv, 'Amazon Prime Video')

  // Monday night slot: 2026-10-12T23:15:00Z
  const monEvent = {
    date: '2026-10-12T23:15:00Z',
    competitions: [{ broadcasts: [] }],
  }
  const monInfo = getGameBroadcastDetails(monEvent)
  assert.equal(monInfo.usTv, 'ESPN')

  // Sunday night carryover slot: Mon 02:00 UTC (SNF)
  const snfEvent = {
    date: '2026-10-12T02:00:00Z',
    competitions: [{ broadcasts: [] }],
  }
  const snfInfo = getGameBroadcastDetails(snfEvent)
  assert.equal(snfInfo.usTv, 'NBC')

  // Thursday night carryover slot: Fri 02:00 UTC (TNF)
  const tnfLateEvent = {
    date: '2026-10-09T02:00:00Z',
    competitions: [{ broadcasts: [] }],
  }
  const tnfLateInfo = getGameBroadcastDetails(tnfLateEvent)
  assert.equal(tnfLateInfo.usTv, 'Amazon Prime Video')
})

// 4. DrivePlays Category Colors, Staggering Lanes, and Kickoff Classifications
test('drivePlays helper coverage for edge cases', async () => {
  const { getPlayColor, getPlayLaneY, isKickoffPlay } = await import('./drivePlays.ts')

  // Category fallback color
  assert.equal(getPlayColor('unknown_category'), '#94a3b8')

  // Staggered play lane for totalPlays > 6
  const lane7 = getPlayLaneY(7, 12)
  assert.ok(lane7 >= 85 && lane7 <= 320)

  // isKickoffPlay with down=0 or special teams down
  const kickPlay = {
    down: 0,
    text: 'J.Moody kicks 65 yards from SF 35 to the end zone',
    type: { text: 'Kick' },
  }
  assert.equal(isKickoffPlay(kickPlay), true)

  const nonOffensiveKick = {
    start: { down: 0 },
    text: 'Kicks 50 yards',
    type: { text: 'kick' },
  }
  assert.equal(isKickoffPlay(nonOffensiveKick), true)

  // Test special teams exclusions (punt, field goal, extra point)
  assert.equal(isKickoffPlay({ start: { down: 0 }, text: 'Punts 45 yards', type: { text: 'punt' } }), false)
  assert.equal(isKickoffPlay({ start: { down: 0 }, text: '42 yd field goal is GOOD', type: { text: 'field goal' } }), false)
  assert.equal(isKickoffPlay({ start: { down: 0 }, text: 'Extra point is GOOD', type: { text: 'extra point' } }), false)

  // generateMockDrivePlays with left direction
  const { generateMockDrivePlays, parseRawESPNPlays } = await import('./drivePlays.ts')
  const leftPlays = generateMockDrivePlays(35, 'left', 'DET')
  assert.ok(leftPlays.length >= 4)
  assert.equal(leftPlays[0].category, 'run')

  // parseRawESPNPlays without end.yardLine
  const parsedPlaysNoEnd = parseRawESPNPlays([
    {
      id: 'p-no-end',
      text: 'Rush 7 yards',
      type: { text: 'Rush' },
      statYardage: 7,
      start: { yardLine: 40 },
    },
  ])
  assert.equal(parsedPlaysNoEnd[0].endYardLine, 47)
})

// 5. AnnouncerRegistry Kickoff Date Matching
test('announcerRegistry matches by kickoffDate when season/week are omitted', async () => {
  const { findVerifiedCrew } = await import('../data/announcerRegistry.ts')

  // Match using date timestamp e.g. 2026 Week 4 kickoff PIT @ CLE
  const result = findVerifiedCrew(undefined, undefined, 'PIT', 'CLE', '2026-10-02T00:15:00Z')
  assert.ok(result)
  assert.equal(result.network, 'Amazon Prime Video')
  assert.equal(result.playByPlay, 'Al Michaels')
})

// 6. Scorigami Date Formatting and Novel Score Target Path
test('scorigami date formatting and novel score messaging', async () => {
  const { formatHistoricalDate, getScorigamiInfo } = await import('./scorigami.ts')

  // Malformed date strings return unaltered string
  assert.equal(formatHistoricalDate('not-a-date'), 'not-a-date')
  assert.equal(formatHistoricalDate(''), '')

  // Novel score with alternate candidates
  const res = getScorigamiInfo(73, 38, 60, 'in', 'MIA', 'DEN')
  assert.ok(res)
  assert.ok(res.whenScenario.length > 0)

  // Novel score in 1st quarter with dh > 0 / da > 0
  const resEarly = getScorigamiInfo(4, 4, 3200, 'in', 'KC', 'BUF')
  assert.ok(resEarly.whenScenario.length > 0)

  // Novel score with 0 seconds remaining
  const resExp = getScorigamiInfo(73, 38, 0, 'in', 'MIA', 'DEN')
  assert.ok(resExp.whenScenario.length > 0)
})

// 7. WinProbability OverUnder string parsing and spread decay in-game
test('winProbability handles overUnder string and in-game spread decay', async () => {
  const { calculateWinProbability, getBettingOddsInfo } = await import('./winProbability.ts')

  // Betting odds with string overUnder
  const oddsInfo = getBettingOddsInfo([
    {
      overUnder: '51.5',
      spread: -3.5,
      provider: { name: 'ESPN BET' },
    },
  ])
  assert.equal(oddsInfo.overUnder, 'O/U 51.5')
  assert.equal(oddsInfo.overUnderValue, 51.5)

  // In-game calculation with live spread defined
  const liveWp = calculateWinProbability({
    homeCompetitor: { id: '1', homeAway: 'home', score: 14, team: { abbreviation: 'KC' } },
    awayCompetitor: { id: '2', homeAway: 'away', score: 10, team: { abbreviation: 'BUF' } },
    gameState: 'in',
    status: {
      type: { state: 'in' },
      period: 2,
      clock: 900,
    },
    situation: {
      yardLine: 40,
      down: 1,
      distance: 10,
      possession: '1',
    },
    odds: [
      {
        spread: -3.5,
        provider: { name: 'Vegas' },
      },
    ],
  })
  assert.ok(liveWp)
  assert.ok(liveWp.homePct > 0 && liveWp.homePct < 100)
})

// 8. NFLHelpers Calendar Navigation, Color Contrast, and Reconciler Edge Cases
test('nflHelpers nextWeek/prevWeek across calendar boundaries', async () => {
  const {
    getNextWeek,
    getPrevWeek,
    resolveContrastingTeamColors,
    reconcileScoreboardData,
    formatDownAndDistance,
    isRedZoneSituation,
    isHalftimeSituation,
    formatLocalizedKickoff,
    sanitizePatriotsInEvent,
  } = await import('./nflHelpers.ts')

  // getNextWeek
  assert.deepEqual(getNextWeek(1, 1), { seasonType: 1, weekNumber: 2 })
  assert.deepEqual(getNextWeek(1, 3), { seasonType: 2, weekNumber: 1 })
  assert.deepEqual(getNextWeek(2, 10), { seasonType: 2, weekNumber: 11 })
  assert.deepEqual(getNextWeek(2, 18), { seasonType: 3, weekNumber: 1 })
  assert.deepEqual(getNextWeek(3, 2), { seasonType: 3, weekNumber: 3 })
  assert.deepEqual(getNextWeek(3, 5), { seasonType: 3, weekNumber: 5 })
  assert.deepEqual(getNextWeek(99, 1), { seasonType: 2, weekNumber: 1 })

  // getPrevWeek
  assert.deepEqual(getPrevWeek(3, 3), { seasonType: 3, weekNumber: 2 })
  assert.deepEqual(getPrevWeek(3, 1), { seasonType: 2, weekNumber: 18 })
  assert.deepEqual(getPrevWeek(2, 5), { seasonType: 2, weekNumber: 4 })
  assert.deepEqual(getPrevWeek(2, 1), { seasonType: 2, weekNumber: 1 })
  assert.deepEqual(getPrevWeek(1, 3), { seasonType: 1, weekNumber: 2 })
  assert.deepEqual(getPrevWeek(1, 1), { seasonType: 1, weekNumber: 1 })
  assert.deepEqual(getPrevWeek(99, 1), { seasonType: 2, weekNumber: 1 })

  // Color contrast green, purple, and ultimate fallback
  const greenCompHome = { team: { color: '208020' } }
  const greenCompAway = { team: { color: '228222' } }
  const greenPair = resolveContrastingTeamColors(greenCompHome, greenCompAway)
  assert.ok(greenPair.homeColor && greenPair.awayColor)

  const purpleCompHome = { team: { color: '800080' } }
  const purpleCompAway = { team: { color: '850085' } }
  const purplePair = resolveContrastingTeamColors(purpleCompHome, purpleCompAway)
  assert.ok(purplePair.homeColor && purplePair.awayColor)

  const clashHome = { team: { color: 'd4a816' } }
  const clashAway = { team: { color: 'd4a816' } }
  const clashPair = resolveContrastingTeamColors(clashHome, clashAway)
  assert.equal(clashPair.homeColor, '#0ea5e9')
  assert.equal(clashPair.awayColor, '#f43f5e')

  // formatDownAndDistance fallback shortDownDistanceText
  assert.equal(
    formatDownAndDistance({ down: 5, distance: 0, shortDownDistanceText: 'Goal to Go' }),
    'Goal to Go'
  )

  // isRedZoneSituation boundaries
  assert.equal(
    isRedZoneSituation({ down: 1, yardLine: 0 }, { type: { state: 'in' }, clock: 300 }, []),
    false
  )
  assert.equal(
    isRedZoneSituation({ down: 1, yardLine: 100 }, { type: { state: 'in' }, clock: 300 }, []),
    false
  )
  assert.equal(
    isRedZoneSituation({ down: 1, yardLine: 85 }, { type: { state: 'in', detail: 'Weather Delay' }, clock: 300 }, []),
    false
  )

  // isHalftimeSituation detail 'half' without 1st or 2nd half
  assert.equal(
    isHalftimeSituation({ type: { state: 'in', detail: 'At Half' }, period: 2 }),
    true
  )
  assert.equal(
    isHalftimeSituation({ type: { state: 'in' }, period: 2, clock: 50 }, { lastPlay: { text: 'End of 2nd quarter' } }),
    true
  )

  // formatLocalizedKickoff invalid date string and custom invalid timezone catch block
  assert.equal(formatLocalizedKickoff('not-a-valid-date'), 'Upcoming')
  assert.equal(formatLocalizedKickoff('2026-10-04T17:00:00Z', 'Invalid/TimeZone_ABC'), 'Upcoming')

  // sanitizePatriotsInEvent with Date and RegExp in clone
  const evWithDateAndRegExp = {
    id: 'ev-special',
    name: 'New England Patriots vs Buffalo Bills',
    createdDate: new Date('2026-10-04T17:00:00Z'),
    pattern: /patriots/i,
    competitors: [{ team: { name: 'Patriots', abbreviation: 'NE' } }],
  }
  const sanitizedSpecial = sanitizePatriotsInEvent(evWithDateAndRegExp)
  assert.ok(sanitizedSpecial)
  // getOffensiveDrive with possessionText fallbacks
  const { getOffensiveDrive } = await import('./nflHelpers.ts')
  const competitorsSample = [
    { id: '1', homeAway: 'home', team: { abbreviation: 'KC' } },
    { id: '2', homeAway: 'away', team: { abbreviation: 'BUF' } },
  ]
  const driveHomeText = getOffensiveDrive({ possession: null, possessionText: 'KC 25' }, competitorsSample)
  assert.equal(driveHomeText.direction, 'right')
  assert.equal(driveHomeText.offensiveTeam?.id, '1')

  const driveAwayText = getOffensiveDrive({ possession: null, possessionText: 'BUF 40' }, competitorsSample)
  assert.equal(driveAwayText.direction, 'left')
  assert.equal(driveAwayText.offensiveTeam?.id, '2')

  const competitorsPats = [
    { id: '1', homeAway: 'home', team: { abbreviation: 'FNE' } },
    { id: '2', homeAway: 'away', team: { abbreviation: 'MIA' } },
  ]
  const drivePatsText = getOffensiveDrive({ possession: null, possessionText: 'NE 30' }, competitorsPats)
  assert.equal(drivePatsText.direction, 'right')

  // Reconcile transitions: game going final, quarter advancing, clock fallback
  const prevLive = {
    events: [
      {
        id: 'ev-1',
        status: { type: { state: 'in' }, period: 1, clock: 500 },
        competitions: [{ status: { clock: 500 } }],
      },
      {
        id: 'ev-2',
        status: { type: { state: 'in' }, period: 2, clock: 400 },
        competitions: [{ status: { clock: 400 } }],
      },
      {
        id: 'ev-3',
        status: { type: { state: 'post' } },
        competitions: [{ status: { type: { state: 'post' } } }],
      },
      {
        id: 'ev-4',
        competitions: [
          {
            status: { type: { state: 'in' }, period: 2, clock: 300 },
            situation: { lastPlay: { id: 'p4', text: 'Touchdown' } },
          },
        ],
      },
    ],
  }
  const nextReconciled = {
    events: [
      {
        id: 'ev-1',
        status: { type: { state: 'post' } }, // Game went final
        competitions: [{ status: { type: { state: 'post' } } }],
      },
      {
        id: 'ev-2',
        status: { type: { state: 'in' }, period: 3, clock: 900 }, // Period advanced
        competitions: [{ status: { clock: 900 } }],
      },
      {
        id: 'ev-3',
        status: { type: { state: 'post' } }, // Already final stays final
        competitions: [{ status: { type: { state: 'post' } } }],
      },
      {
        id: 'ev-4',
        competitions: [
          {
            status: { type: { state: 'in' }, period: 2, clock: 300 },
            situation: { lastPlay: null }, // Same clock with empty incoming lastPlay retains prev lastPlay
          },
        ],
      },
    ],
  }
  const recResult = reconcileScoreboardData(prevLive, nextReconciled)
  assert.equal(recResult.events[0].status.type.state, 'post')
  assert.equal(recResult.events[1].status.period, 3)
  assert.equal(recResult.events[3].competitions[0].situation.lastPlay.text, 'Touchdown')

  // Invalid nextData guard
  assert.deepEqual(reconcileScoreboardData(prevLive, null), null)

  // Reconcile clock jitter <= 3s clamps clock
  const prevData = {
    events: [
      {
        id: 'ev-jitter',
        status: { type: { state: 'in' }, period: 1, clock: 500 },
        competitions: [
          {
            status: { type: { state: 'in' }, clock: 500 },
            situation: { lastPlay: { id: 'p1', text: 'Prev play' } },
          },
        ],
      },
    ],
  }
  const nextData = {
    events: [
      {
        id: 'ev-jitter',
        status: { type: { state: 'in' }, period: 1, clock: 502 }, // Jittered back by 2 seconds
        competitions: [
          {
            status: { type: { state: 'in' }, clock: 502 },
            situation: { lastPlay: null },
          },
        ],
      },
    ],
  }
  const reconciled = reconcileScoreboardData(prevData, nextData)
  assert.ok(reconciled)
  assert.equal(reconciled.events[0].status.clock, 500)
})

// 9. Normalizer URI Error and Invalid URL Handling
test('normalizer handles invalid URIs and malformed percent encodings', async () => {
  const { sanitizeUrl } = await import('./normalizer.ts')

  // Malformed percent encoding that throws URIError in decodeURIComponent
  const malformedUri = 'https://example.com/test?q=%E0%A4%A'
  assert.equal(sanitizeUrl(malformedUri), malformedUri)

  // Completely invalid URL strings return FALLBACK_LOGO
  const fallback = 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png'
  assert.equal(sanitizeUrl('not a valid url'), fallback)
  assert.equal(sanitizeUrl('http://user:pass@evil.com'), fallback)

  // Malformed percent encoding in SVG data URI that triggers catch block in decodeAllEntities
  const svgMalformedPercent = 'data:image/svg+xml;utf8,<svg>%E0%A4%A</svg>'
  assert.equal(sanitizeUrl(svgMalformedPercent), svgMalformedPercent)

  // Invalid fallback string triggers isSafeHttpUrl catch block and falls back to FALLBACK_LOGO
  assert.equal(sanitizeUrl(null, 'invalid-fallback-url'), fallback)
})

// 10. Additional Power Rankings Branches
test('powerRankings spotlights NYG if live and falls back gracefully on non-standard states', async () => {
  const { getBestMatchupByPowerRanking } = await import('./powerRankings.ts')

  // NY Giants live game takes priority
  const nygGame = {
    id: 'nyg-live',
    status: { type: { state: 'in' } },
    competitions: [
      {
        status: { type: { state: 'in' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'NYG', name: 'Giants' } },
          { homeAway: 'away', team: { abbreviation: 'PHI', name: 'Eagles' } },
        ],
      },
    ],
  }
  const otherLiveGame = {
    id: 'other-live',
    status: { type: { state: 'in' } },
    competitions: [
      {
        status: { type: { state: 'in' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'KC', name: 'Chiefs' } },
          { homeAway: 'away', team: { abbreviation: 'BUF', name: 'Bills' } },
        ],
      },
    ],
  }
  assert.equal(getBestMatchupByPowerRanking([otherLiveGame, nygGame])?.id, 'nyg-live')

  // Non-standard state (e.g. delayed/suspended/postponed) triggers line 171 return events[0]
  const suspendedGame = {
    id: 'suspended-1',
    status: { type: { state: 'suspended' } },
    competitions: [
      {
        status: { type: { state: 'suspended' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'MIA', name: 'Dolphins' } },
          { homeAway: 'away', team: { abbreviation: 'NYJ', name: 'Jets' } },
        ],
      },
    ],
  }
  assert.equal(getBestMatchupByPowerRanking([suspendedGame])?.id, 'suspended-1')
})

// 11. Additional Win Probability Branches
test('winProbability handles tied final games, normalization, overtime, and spread prior', async () => {
  const { calculateWinProbability, getBettingOddsInfo } = await import('./winProbability.ts')

  // Tied final game
  const tiedFinal = calculateWinProbability({
    gameState: 'post',
    homeScore: 24,
    awayScore: 24,
  })
  assert.equal(tiedFinal.homePct, 50)
  assert.equal(tiedFinal.awayPct, 50)
  assert.equal(tiedFinal.favoredName, 'Tied')
  assert.equal(tiedFinal.modelSource, 'Final')

  // In-game FPI normalization when raw sums don't equal 100
  const normalizedFpi = calculateWinProbability({
    gameState: 'in',
    homeWinPercentage: 0.6,
    awayWinPercentage: 0.5, // total = 1.10
  })
  assert.equal(normalizedFpi.modelSource, 'ESPN FPI')
  assert.ok(Math.abs(normalizedFpi.homePct + normalizedFpi.awayPct - 100) <= 0.2)

  // Live model overtime (period >= 5)
  const otModel = calculateWinProbability({
    gameState: 'in',
    homeCompetitor: { id: 'home-1' },
    awayCompetitor: { id: 'away-1' },
    status: { period: 5, clock: 450 },
    situation: { down: 2, yardLine: 40, possession: 'away-1' }, // away driving in OT
    odds: [{ spread: -3.5 }],
    homeScore: 20,
    awayScore: 20,
  })
  assert.equal(otModel.modelSource, 'Live Analytic Model')
  assert.ok(otModel.awayPct > otModel.homePct) // away has ball at opponent 40

  // Odds formatting edge cases
  const pickOdds = getBettingOddsInfo([{ details: 'pick' }])
  assert.equal(pickOdds.handicap, 'EVEN')

  const spreadZero = getBettingOddsInfo([{ spread: 0 }])
  assert.equal(spreadZero.handicap, 'EVEN')

  const spreadPositive = getBettingOddsInfo([{ spread: 3.5 }], 'CHI', 'GB')
  assert.equal(spreadPositive.handicap, 'GB -3.5')

  const spreadNegative = getBettingOddsInfo([{ spread: -4 }], 'CHI', 'GB')
  assert.equal(spreadNegative.handicap, 'CHI -4')
})

// 12. Normalizer Situational Direction, Kickoff / PAT, and Goal-to-Go
test('normalizer handles away team possession, left-direction goal-to-go, and kickoff formatting', async () => {
  const { normalizeNFLEvent } = await import('./normalizer.ts')

  // Away team possessionText fallback, down <= 0 (Kickoff / PAT)
  const evKickoff = normalizeNFLEvent({
    id: 'norm-ko',
    status: { type: { state: 'in' } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'KC' } },
          { homeAway: 'away', team: { abbreviation: 'BUF' } },
        ],
        situation: {
          possessionText: 'BUF 35',
          down: 0,
          distance: 0,
          yardLine: 35,
          downDistanceText: '', // triggers Kickoff / PAT formatting
        },
      },
    ],
  })
  assert.ok(evKickoff)
  assert.equal(evKickoff.situation.formattedText, 'Kickoff / PAT')
  assert.equal(evKickoff.situation.direction, 'left')

  // Left direction goal-to-go and redzone
  const evGoalToGo = normalizeNFLEvent({
    id: 'norm-gtg',
    status: { type: { state: 'in' } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'KC' } },
          { homeAway: 'away', team: { abbreviation: 'BUF' } },
        ],
        situation: {
          possessionText: 'BUF 5',
          down: 2,
          distance: 5,
          yardLine: 5,
          downDistanceText: '', // triggers 2nd & Goal
        },
      },
    ],
  })
  assert.ok(evGoalToGo)
  assert.equal(evGoalToGo.situation.formattedText, '2nd & Goal at BUF 5')
  assert.equal(evGoalToGo.situation.isGoalToGo, true)
  assert.equal(evGoalToGo.situation.isRedZone, true)
})

// 13. DrivePlays Comprehensive Categorization and Parsing
test('drivePlays categorizes all running/passing play phrasing and generates play sequence IDs', async () => {
  const { categorizePlay, parseRawESPNPlays } = await import('./drivePlays.ts')

  assert.equal(categorizePlay('', 'Player penalized 5 yards for false start'), 'penalty')
  assert.equal(categorizePlay('', 'Quarterback passed deep right for 30 yards'), 'pass')
  assert.equal(categorizePlay('', 'Running back ran up the middle for 4 yards'), 'run')
  assert.equal(categorizePlay('', 'Runner off left tackle for 6 yards'), 'run')
  assert.equal(categorizePlay('', 'Runner off right tackle for 2 yards'), 'run')
  assert.equal(categorizePlay('', 'Runner around left end for 12 yards'), 'run')
  assert.equal(categorizePlay('', 'Runner around right end for 8 yards'), 'run')
  assert.equal(categorizePlay('', 'Runner through left guard for 3 yards'), 'run')
  assert.equal(categorizePlay('', 'Runner through right guard for 1 yard'), 'run')

  // parseRawESPNPlays handles missing id and generates sequence ID
  const parsedPlays = parseRawESPNPlays([
    {
      text: 'Pass short left for 5 yards',
      type: { text: 'Pass Reception' },
      start: { yardLine: 25, down: 1 },
      statYardage: 5,
    },
  ])
  assert.equal(parsedPlays.length, 1)
  assert.equal(parsedPlays[0].id, 'play-1')
  assert.equal(parsedPlays[0].category, 'pass')
})

// 14. PowerRankings Kickoff Timestamps and Halftime/Final Matchup Resolution
test('powerRankings handles invalid kickoff dates, empty inputs, halftime slates, and completed slates', async () => {
  const { getEventKickoffMs, getBestMatchupByPowerRanking } = await import('./powerRankings.ts')

  // Kickoff date edge cases
  assert.equal(getEventKickoffMs({ id: 'no-date', competitions: [{}] }), Infinity)
  assert.equal(getEventKickoffMs({ id: 'invalid-date', date: 'not-a-date' }), Infinity)

  // Empty or invalid event arrays return null
  assert.equal(getBestMatchupByPowerRanking(null), null)
  assert.equal(getBestMatchupByPowerRanking(undefined), null)
  assert.equal(getBestMatchupByPowerRanking([]), null)

  // Slate with ONLY halftime games
  const htGame1 = {
    id: 'ht-1',
    status: { type: { state: 'in', description: 'Halftime' } },
    competitions: [
      {
        status: { type: { state: 'in', description: 'Halftime' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'CAR' } },
          { homeAway: 'away', team: { abbreviation: 'TEN' } },
        ],
      },
    ],
  }
  const htGame2 = {
    id: 'ht-2',
    status: { type: { state: 'in', description: 'Halftime' } },
    competitions: [
      {
        status: { type: { state: 'in', description: 'Halftime' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'KC' } },
          { homeAway: 'away', team: { abbreviation: 'BUF' } },
        ],
      },
    ],
  }
  const bestHt = getBestMatchupByPowerRanking([htGame1, htGame2])
  assert.equal(bestHt?.id, 'ht-2') // KC vs BUF has much better power ranking

  // Slate with ONLY completed (post) games
  const postGame1 = {
    id: 'post-1',
    status: { type: { state: 'post' } },
    competitions: [
      {
        status: { type: { state: 'post' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'CAR' } },
          { homeAway: 'away', team: { abbreviation: 'TEN' } },
        ],
      },
    ],
  }
  const postGame2 = {
    id: 'post-2',
    status: { type: { state: 'post' } },
    competitions: [
      {
        status: { type: { state: 'post' } },
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'KC' } },
          { homeAway: 'away', team: { abbreviation: 'BUF' } },
        ],
      },
    ],
  }
  const bestPost = getBestMatchupByPowerRanking([postGame1, postGame2])
  assert.equal(bestPost?.id, 'post-2')
})

// 15. Audio Feedback WebKit Fallback, Exception Handling, and Autoplay Catch Blocks
test('audioFeedback handles webkitAudioContext, getAudioContext exceptions, and autoplay catch blocks', async () => {
  const { playRedZoneSound, playScoreChime, playTactileClick, _resetAudioContextForTesting } = await import(
    './audioFeedback.ts'
  )

  const originalWindow = globalThis.window

  class MockWebkitAudioContext {
    state = 'running'
    currentTime = 0
    destination = {}
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
      }
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
      }
    }
  }

  try {
    _resetAudioContextForTesting()
    globalThis.window = {
      webkitAudioContext: MockWebkitAudioContext,
    }
    // Should run smoothly with webkitAudioContext
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)

    // createOscillator throwing autoplay error (caught by try/catch in each player)
    _resetAudioContextForTesting()
    class ThrowingAudioContext extends MockWebkitAudioContext {
      createOscillator() {
        throw new Error("NotAllowedError: play() failed because the user didn't interact first")
      }
    }
    globalThis.window = {
      AudioContext: ThrowingAudioContext,
    }
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)

    // AudioContext constructor throwing error (caught by getAudioContext)
    _resetAudioContextForTesting()
    globalThis.window = {
      AudioContext: class {
        constructor() {
          throw new Error('SecurityError')
        }
      },
    }
    playRedZoneSound(false)
    playScoreChime(false)
    playTactileClick(false)
  } finally {
    _resetAudioContextForTesting()
    globalThis.window = originalWindow
  }
})

// 16. PowerRankings & DrivePlays Remaining Edge Cases
test('powerRankings and drivePlays exhaustive edge branches', async () => {
  const { getTeamPowerRank, getMatchupPowerScore, getBestMatchupByPowerRanking } = await import(
    './powerRankings.ts'
  )
  const { isKickoffPlay, getPlayCategoryLabel, getPlayColor } = await import('./drivePlays.ts')

  // getTeamPowerRank default argument
  assert.equal(getTeamPowerRank(), 20)
  assert.equal(getTeamPowerRank('   '), 20)

  // getMatchupPowerScore without competitions
  assert.equal(getMatchupPowerScore({}), 40.2)

  // Pre-game slate where all games have invalid kickoff dates (Number.isFinite(earliestKickoff) === false)
  const preInvalid1 = {
    id: 'pre-inv-1',
    status: { type: { state: 'pre' } },
    date: 'invalid',
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'CAR' } },
          { homeAway: 'away', team: { abbreviation: 'TEN' } },
        ],
      },
    ],
  }
  const preInvalid2 = {
    id: 'pre-inv-2',
    status: { type: { state: 'pre' } },
    date: 'also-invalid',
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { abbreviation: 'KC' } },
          { homeAway: 'away', team: { abbreviation: 'BUF' } },
        ],
      },
    ],
  }
  const bestPreInv = getBestMatchupByPowerRanking([preInvalid1, preInvalid2])
  assert.equal(bestPreInv?.id, 'pre-inv-2') // KC vs BUF prioritized via power score

  // Drive plays labels and colors
  assert.equal(getPlayCategoryLabel('kick'), 'Kick')
  assert.equal(getPlayCategoryLabel('unknown'), 'Play')
  assert.equal(getPlayColor('unknown'), '#94a3b8')

  // Kickoff play detection special teams down with kicks text
  const stKick = {
    down: 0,
    type: { text: 'Kick' },
    text: 'Kicker kicks ball',
  }
  assert.equal(isKickoffPlay(stKick), true)
})

// 17. Broadcast Windows & Drive Play Left Direction Staggers
test('broadcastInfo fallback branches and drivePlays left direction mock generation', async () => {
  const { getGameBroadcastDetails } = await import('./broadcastInfo.ts')
  const { generateMockDrivePlays, getPlayLaneY } = await import('./drivePlays.ts')

  // Drive plays left direction mock generation
  const leftPlays = generateMockDrivePlays(40, 'left', 'DAL')
  assert.equal(leftPlays.length, 5)
  assert.equal(leftPlays[0].category, 'run')
  assert.ok(leftPlays[0].text.includes('DAL'))

  // getPlayLaneY staggered lane calculation for drives > 6 plays
  const laneY = getPlayLaneY(8, 12)
  assert.ok(typeof laneY === 'number' && Number.isFinite(laneY))

  // BroadcastInfo: Invalid date string triggering catch in DateTimeFormat formatToParts
  const invalidDateEvent = {
    date: 'invalid-date-string-that-causes-range-error',
    competitions: [
      {
        broadcasts: [{ names: ['FOX'] }],
      },
    ],
  }
  const infoInvalidDate = getGameBroadcastDetails(invalidDateEvent)
  assert.equal(infoInvalidDate.usTv, 'FOX')

  // BroadcastInfo: Thursday Night Football window with unspecified network
  // In London, 23:30 on Thursday night corresponds to TNF kickoff window
  const tnfEvent = {
    date: '2026-10-08T23:30:00Z',
    competitions: [
      {
        broadcasts: [{ names: [] }],
      },
    ],
  }
  const infoTnf = getGameBroadcastDetails(tnfEvent)
  assert.equal(infoTnf.usTv, 'Amazon Prime Video')

  // BroadcastInfo: Sunday Night Football window with unspecified network
  const snfEvent = {
    date: '2026-10-04T23:30:00Z',
    competitions: [
      {
        broadcasts: [{ names: [] }],
      },
    ],
  }
  const infoSnf = getGameBroadcastDetails(snfEvent)
  assert.equal(infoSnf.usTv, 'NBC')

  // BroadcastInfo: Monday Night Football window with unspecified network
  const mnfEvent = {
    date: '2026-10-05T23:30:00Z',
    competitions: [
      {
        broadcasts: [{ names: [] }],
      },
    ],
  }
  const infoMnf = getGameBroadcastDetails(mnfEvent)
  assert.equal(infoMnf.usTv, 'ESPN')

  // Network matching with AMAZON and pure ESPN
  assert.equal(
    getGameBroadcastDetails({ competitions: [{ broadcasts: [{ names: ['AMAZON'] }] }] }).usTv,
    'Amazon Prime Video'
  )
  assert.equal(
    getGameBroadcastDetails({ competitions: [{ broadcasts: [{ names: ['ESPN'] }] }] }).usTv,
    'ESPN'
  )
})

// 18. Scorigami Date Formatting and Fallback Branches
test('scorigami formatHistoricalDate handles empty strings and invalid formats', async () => {
  const { formatHistoricalDate, getScorigamiInfo } = await import('./scorigami.ts')

  assert.equal(formatHistoricalDate(''), '')
  assert.equal(formatHistoricalDate('invalid'), 'invalid')
  assert.equal(formatHistoricalDate('2026-09'), '2026-09')
  assert.equal(formatHistoricalDate('2026-09-20'), 'Sep 20, 2026')

  // No realistic scorigami path remaining with 1 second left and common score
  const noPath = getScorigamiInfo(20, 17, 1, 'in')
  assert.ok(noPath)

  // Novel score holding with no other candidates
  const novelHold = getScorigamiInfo(70, 70, 1, 'in')
  assert.ok(novelHold.isCurrentScorigami)
})

// 19. Scoreboard Monotonic Invariants & Kickoff Exclusion Edge Cases
test('reconcileScoreboardData enforces monotonic invariants across game states and periods', async () => {
  const { reconcileScoreboardData } = await import('./nflHelpers.ts')
  const { isKickoffPlay } = await import('./drivePlays.ts')

  // Force option bypasses reconciler
  const rawPrev = { events: [{ id: '1', status: { type: { state: 'in' } } }] }
  const rawNext = { events: [{ id: '1', status: { type: { state: 'pre' } } }] }
  assert.equal(reconcileScoreboardData(rawPrev, rawNext, { force: true }), rawNext)

  // Invariant 1: Final game cannot revert to live without review
  const postGame = { events: [{ id: 'ev-post', status: { type: { state: 'post' } } }] }
  const liveRevert = { events: [{ id: 'ev-post', status: { type: { state: 'in' } } }] }
  const recPost = reconcileScoreboardData(postGame, liveRevert)
  assert.equal(recPost.events[0].status.type.state, 'post')

  // Final game CAN revert if official overturn indicated
  const liveOverturn = {
    events: [
      {
        id: 'ev-post',
        status: { type: { state: 'in', detail: 'Ruling overturned on review' } },
      },
    ],
  }
  const recOverturn = reconcileScoreboardData(postGame, liveOverturn)
  assert.equal(recOverturn.events[0].status.type.state, 'in')

  // Invariant 2: Live game cannot revert to pre-game
  const liveGame = { events: [{ id: 'ev-live', status: { type: { state: 'in' } } }] }
  const preRevert = { events: [{ id: 'ev-live', status: { type: { state: 'pre' } } }] }
  const recPre = reconcileScoreboardData(liveGame, preRevert)
  assert.equal(recPre.events[0].status.type.state, 'in')

  // Invariant 3: Period cannot regress without official review
  const q3Game = { events: [{ id: 'ev-q', status: { type: { state: 'in' }, period: 3 } }] }
  const q2Regress = { events: [{ id: 'ev-q', status: { type: { state: 'in' }, period: 2 } }] }
  const recQ = reconcileScoreboardData(q3Game, q2Regress)
  assert.equal(recQ.events[0].status.period, 3)

  // Period CAN regress with overturn
  const q2Overturn = {
    events: [
      {
        id: 'ev-q',
        status: { type: { state: 'in', detail: 'Play overturned, reset to Q2' }, period: 2 },
      },
    ],
  }
  const recQOverturn = reconcileScoreboardData(q3Game, q2Overturn)
  assert.equal(recQOverturn.events[0].status.period, 2)

  // isKickoffPlay special teams down non-kickoffs (punts, field goals, extra points)
  assert.equal(isKickoffPlay({ down: 0, type: { text: 'Punt' }, text: 'Punts 50 yards' }), false)
  assert.equal(isKickoffPlay({ down: 0, type: { text: 'Field Goal' }, text: 'Field goal is good' }), false)
  assert.equal(isKickoffPlay({ down: 0, type: { text: 'Extra Point' }, text: 'Extra point is good' }), false)

  // parseRawESPNPlays filtering timeouts, kickoffs, string types, and abbreviations
  const { parseRawESPNPlays } = await import('./drivePlays.ts')
  assert.deepEqual(parseRawESPNPlays(null), [])
  const playsWithTimeout = parseRawESPNPlays([
    null,
    { type: { text: 'Official Timeout' } },
    { type: { text: 'Kickoff' } },
    { type: 'Kickoff' },
    { type: { abbreviation: 'KR' } },
    { type: { id: 53 } },
    { text: 'H.Butker kicks 65 yards from KC 35' },
    { text: 'Onside kick recovered by KC' },
    {
      id: 'p-valid',
      text: 'Pass complete for 10 yards',
      type: { text: 'Pass' },
      start: { yardLine: 20 },
      end: { yardLine: 30 },
    },
  ])
  assert.equal(playsWithTimeout.length, 1)
  assert.equal(playsWithTimeout[0].id, 'p-valid')
})








