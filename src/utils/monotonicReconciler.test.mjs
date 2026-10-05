import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileScoreboardData } from './nflHelpers.ts'

test('reconcileScoreboardData: returns nextData if prevData is null or empty', () => {
  const nextData = {
    events: [
      {
        id: 'ev-1',
        status: { period: 1, clock: 800, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '7' }, { homeAway: 'away', score: '3' }] }],
      },
    ],
  }

  const result1 = reconcileScoreboardData(null, nextData)
  assert.equal(result1.events[0].id, 'ev-1')

  const result2 = reconcileScoreboardData({ events: [] }, nextData)
  assert.equal(result2.events[0].id, 'ev-1')
})

test('reconcileScoreboardData: Completed game NEVER reverts to live or pre-game', () => {
  const prevData = {
    events: [
      {
        id: 'game-final',
        status: { period: 4, clock: 0, type: { state: 'post', completed: true } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '27' }, { homeAway: 'away', score: '24' }] }],
      },
    ],
  }

  // Incoming stale payload from an old CDN mirror says game is in progress
  const staleData = {
    events: [
      {
        id: 'game-final',
        status: { period: 4, clock: 44, type: { state: 'in', completed: false } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '27' }, { homeAway: 'away', score: '24' }] }],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, staleData)
  assert.equal(reconciled.events[0].status.type.state, 'post')
  assert.equal(reconciled.events[0].status.type.completed, true)
})

test('reconcileScoreboardData: Live game NEVER reverts to pre-game', () => {
  const prevData = {
    events: [
      {
        id: 'game-live',
        status: { period: 2, clock: 450, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '14' }, { homeAway: 'away', score: '10' }] }],
      },
    ],
  }

  const stalePregame = {
    events: [
      {
        id: 'game-live',
        status: { period: 1, clock: 900, type: { state: 'pre' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '0' }, { homeAway: 'away', score: '0' }] }],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, stalePregame)
  assert.equal(reconciled.events[0].status.type.state, 'in')
  assert.equal(reconciled.events[0].status.period, 2)
})

test('reconcileScoreboardData: Quarter/Period NEVER goes backwards', () => {
  const prevData = {
    events: [
      {
        id: 'game-q4',
        status: { period: 4, clock: 200, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '21' }, { homeAway: 'away', score: '17' }] }],
      },
    ],
  }

  const staleQ3 = {
    events: [
      {
        id: 'game-q4',
        status: { period: 3, clock: 100, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '14' }, { homeAway: 'away', score: '17' }] }],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, staleQ3)
  assert.equal(reconciled.events[0].status.period, 4)
  assert.equal(reconciled.events[0].status.clock, 200)
})

test('reconcileScoreboardData: Clock NEVER moves backwards by >3 seconds in same quarter', () => {
  const prevData = {
    events: [
      {
        id: 'game-clock',
        status: { period: 4, clock: 78, type: { state: 'in' } }, // 1:18 remaining
        competitions: [
          {
            status: { clock: 78, period: 4 },
            competitors: [{ homeAway: 'home', score: '27' }, { homeAway: 'away', score: '24' }],
            situation: {
              down: 1,
              distance: 8,
              yardLine: 8,
              lastPlay: { id: 'p2', text: 'P.Mahomes scrambles for 10 yards to BUF 8' },
            },
          },
        ],
      },
    ],
  }

  // Stale CDN cache returns data from 26 seconds ago (1:44 = 104 seconds remaining)
  const staleData = {
    events: [
      {
        id: 'game-clock',
        status: { period: 4, clock: 104, type: { state: 'in' } }, // 1:44 remaining (jumped backwards!)
        competitions: [
          {
            status: { clock: 104, period: 4 },
            competitors: [{ homeAway: 'home', score: '27' }, { homeAway: 'away', score: '24' }],
            situation: {
              down: 3,
              distance: 4,
              yardLine: 18,
              lastPlay: { id: 'p1', text: 'P.Mahomes pass short middle to T.Kelce for 8 yards' },
            },
          },
        ],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, staleData)
  // Reconciler MUST reject the backward time jump and preserve the latest play!
  assert.equal(reconciled.events[0].status.clock, 78)
  assert.equal(reconciled.events[0].competitions[0].situation.yardLine, 8)
  assert.equal(reconciled.events[0].competitions[0].situation.lastPlay.id, 'p2')
})

test('reconcileScoreboardData: Valid clock countdown progress IS accepted', () => {
  const prevData = {
    events: [
      {
        id: 'game-prog',
        status: { period: 4, clock: 78, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '27' }, { homeAway: 'away', score: '24' }] }],
      },
    ],
  }

  const nextValidData = {
    events: [
      {
        id: 'game-prog',
        status: { period: 4, clock: 52, type: { state: 'in' } }, // Clock moved down from 78 to 52
        competitions: [{ competitors: [{ homeAway: 'home', score: '27' }, { homeAway: 'away', score: '24' }] }],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, nextValidData)
  assert.equal(reconciled.events[0].status.clock, 52)
})

test('reconcileScoreboardData: Scores do not decrease on unverified stale mirror repeating older play', () => {
  const prevData = {
    events: [
      {
        id: 'game-score',
        status: { period: 4, clock: 44, type: { state: 'in' } },
        competitions: [
          {
            competitors: [
              { homeAway: 'home', score: '27' },
              { homeAway: 'away', score: '31' }, // Away just scored a TD
            ],
            situation: {
              lastPlay: { id: 'p102', text: 'P.Mahomes pass to X.Worthy for 25 yards, TOUCHDOWN' },
            },
          },
        ],
      },
    ],
  }

  // Stale mirror repeating older play without any review or overturn
  const staleScoreData = {
    events: [
      {
        id: 'game-score',
        status: { period: 4, clock: 44, type: { state: 'in' } },
        competitions: [
          {
            competitors: [
              { homeAway: 'home', score: '27' },
              { homeAway: 'away', score: '24' }, // Stale node forgot the TD!
            ],
            situation: {
              lastPlay: { id: 'p102', text: 'P.Mahomes pass to X.Worthy for 25 yards, TOUCHDOWN' },
            },
          },
        ],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, staleScoreData)
  const awayComp = reconciled.events[0].competitions[0].competitors.find((c) => c.homeAway === 'away')
  assert.equal(awayComp.score, '31')
})

test('reconcileScoreboardData: Overturned touchdown on review DOES decrease score correctly', () => {
  const prevData = {
    events: [
      {
        id: 'game-review-score',
        status: { period: 4, clock: 44, type: { state: 'in' } },
        competitions: [
          {
            competitors: [
              { homeAway: 'home', score: '27' },
              { homeAway: 'away', score: '31' }, // Temporary TD on field
            ],
            situation: {
              lastPlay: { id: 'p105', text: 'P.Mahomes pass to X.Worthy for 25 yards, TOUCHDOWN' },
            },
          },
        ],
      },
    ],
  }

  // Official Replay Review: Touchdown overturned! Receiver was out of bounds at the 2.
  const overturnedData = {
    events: [
      {
        id: 'game-review-score',
        status: { period: 4, clock: 52, type: { state: 'in' } }, // Refs also put 8 seconds back on clock!
        competitions: [
          {
            competitors: [
              { homeAway: 'home', score: '27' },
              { homeAway: 'away', score: '24' }, // Score decreased back to 24!
            ],
            situation: {
              down: 1,
              distance: 2,
              yardLine: 2,
              lastPlay: {
                id: 'p106',
                text: 'Play Overturned: After review, the receiver was out of bounds at the 2-yard line. 1st & Goal.',
              },
            },
          },
        ],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, overturnedData)
  const awayComp = reconciled.events[0].competitions[0].competitors.find((c) => c.homeAway === 'away')
  assert.equal(awayComp.score, '24', 'Score must correctly decrease following official replay review')
  assert.equal(reconciled.events[0].status.clock, 52, 'Time put back on clock must be honored')
  assert.equal(reconciled.events[0].competitions[0].situation.yardLine, 2)
})

test('reconcileScoreboardData: Refs putting time back on the clock IS accepted', () => {
  const prevData = {
    events: [
      {
        id: 'game-time-reset',
        status: { period: 4, clock: 14, type: { state: 'in' } }, // 14 seconds remaining
        competitions: [
          {
            status: { clock: 14, period: 4 },
            competitors: [{ homeAway: 'home', score: '21' }, { homeAway: 'away', score: '20' }],
            situation: {
              lastPlay: { id: 'p201', text: 'J.Allen scrambles out of bounds' },
            },
          },
        ],
      },
    ],
  }

  // Referees instruct the timekeeper to reset clock to 0:26 (+12 seconds back on clock)
  const refClockResetData = {
    events: [
      {
        id: 'game-time-reset',
        status: { period: 4, clock: 26, type: { state: 'in' } }, // Clock reset to 26 seconds
        competitions: [
          {
            status: { clock: 26, period: 4 },
            competitors: [{ homeAway: 'home', score: '21' }, { homeAway: 'away', score: '20' }],
            situation: {
              lastPlay: { id: 'p202', text: 'Clock reset to 0:26 by referee signal after incomplete pass' },
            },
          },
        ],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, refClockResetData)
  assert.equal(reconciled.events[0].status.clock, 26, 'Clock reset by referee must be accepted')
  assert.equal(reconciled.events[0].competitions[0].situation.lastPlay.id, 'p202')
})

test('reconcileScoreboardData: Force manual refresh accepts network truth unconditionally', () => {
  const prevData = {
    events: [
      {
        id: 'game-forced',
        status: { period: 4, clock: 60, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '30' }, { homeAway: 'away', score: '20' }] }],
      },
    ],
  }

  const manualData = {
    events: [
      {
        id: 'game-forced',
        status: { period: 4, clock: 120, type: { state: 'in' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '20' }, { homeAway: 'away', score: '20' }] }],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, manualData, { force: true })
  assert.equal(reconciled.events[0].status.clock, 120)
  assert.equal(reconciled.events[0].competitions[0].competitors[0].score, '20')
})

