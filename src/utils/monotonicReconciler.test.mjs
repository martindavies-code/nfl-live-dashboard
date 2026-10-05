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

test('reconcileScoreboardData: Scores NEVER decrease', () => {
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
          },
        ],
      },
    ],
  }

  const staleScoreData = {
    events: [
      {
        id: 'game-score',
        status: { period: 4, clock: 40, type: { state: 'in' } },
        competitions: [
          {
            competitors: [
              { homeAway: 'home', score: '27' },
              { homeAway: 'away', score: '24' }, // Stale node forgot the TD!
            ],
          },
        ],
      },
    ],
  }

  const reconciled = reconcileScoreboardData(prevData, staleScoreData)
  const awayComp = reconciled.events[0].competitions[0].competitors.find((c) => c.homeAway === 'away')
  assert.equal(awayComp.score, '31')
})
