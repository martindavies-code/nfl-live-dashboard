import test from 'node:test'
import assert from 'node:assert/strict'
import { getMockLiveGames } from './espnApi.ts'

test('getMockLiveGames returns 5 valid events covering live, halftime, final, and upcoming phases', () => {
  const games = getMockLiveGames()
  assert.equal(games.length, 5)

  const chiefsBills = games[0]
  assert.equal(chiefsBills.shortName, 'KC @ BUF')
  assert.equal(chiefsBills.competitions[0].competitors.length, 2)

  const situation = chiefsBills.competitions[0].situation
  assert.ok(situation)
  assert.equal(typeof situation.yardLine, 'number')
  assert.equal(typeof situation.down, 'number')
  assert.ok(situation.lastPlay)

  // Verify upcoming game (mock-4)
  const upcoming = games[3]
  assert.equal(upcoming.shortName, 'BAL @ CIN')
  assert.equal(upcoming.status.type.state, 'pre')
  assert.ok(upcoming.competitions[0].odds)

  // Verify halftime game (mock-5)
  const halftimeGame = games[4]
  assert.equal(halftimeGame.shortName, 'CAR @ CLE')
  assert.equal(halftimeGame.status.type.name, 'STATUS_HALFTIME')
  assert.equal(halftimeGame.status.type.detail, 'Halftime')
})

test('getMockLiveGames advances sequence across sequential calls', () => {
  const g1 = getMockLiveGames()
  const g2 = getMockLiveGames()

  const sit1 = g1[0].competitions[0].situation
  const sit2 = g2[0].competitions[0].situation

  assert.notEqual(sit1.lastPlay.id, sit2.lastPlay.id)
})

test('Multiple games can be in the Red Zone simultaneously', async () => {
  const { isRedZoneSituation } = await import('../utils/nflHelpers.ts')
  const games = getMockLiveGames()

  const redZoneGames = games.filter((g) => {
    const comp = g.competitions?.[0]
    return isRedZoneSituation(comp?.situation, g.status || comp?.status, comp?.competitors || [])
  })

  // We should have at least 1 or 2 Red Zone games simultaneously
  assert.ok(redZoneGames.length >= 1, 'Expected at least 1 Red Zone game')
  const mock2 = games.find((g) => g.id === 'mock-2')
  assert.ok(mock2)
  const mock2Comp = mock2.competitions[0]
  assert.equal(
    isRedZoneSituation(mock2Comp.situation, mock2.status, mock2Comp.competitors),
    true,
    'mock-2 (GB @ DET 12) should be in the Red Zone'
  )
})

test('REAL_NFL_DATA_SOURCES contains 5 valid redundant live endpoints', async () => {
  const { REAL_NFL_DATA_SOURCES } = await import('./espnApi.ts')
  assert.equal(REAL_NFL_DATA_SOURCES.length, 5)

  for (const src of REAL_NFL_DATA_SOURCES) {
    assert.ok(src.id, 'Source must have id')
    assert.ok(src.name, 'Source must have name')
    assert.ok(src.shortName, 'Source must have shortName')
    assert.equal(typeof src.buildUrl, 'function')
    assert.equal(typeof src.parseResponse, 'function')

    const url = src.buildUrl('seasontype=2&week=4')
    assert.ok(url.includes('scoreboard'), `URL for ${src.name} must target scoreboard feed`)
  }
})

test('RedundantSource parsers accurately parse direct events and wrapped content.sbData', async () => {
  const { REAL_NFL_DATA_SOURCES } = await import('./espnApi.ts')
  const fastly = REAL_NFL_DATA_SOURCES.find((s) => s.id === 'espn-cdn-fastly')
  assert.ok(fastly)

  // Direct events shape
  const direct = fastly.parseResponse({ events: [{ id: '123', name: 'KC vs BUF' }] })
  assert.ok(direct)
  assert.equal(direct.events[0].id, '123')

  // Wrapped sbData shape
  const wrapped = fastly.parseResponse({
    content: {
      sbData: {
        events: [{ id: '456', name: 'PHI vs DAL' }],
        week: { number: 4 }
      }
    }
  })
  assert.ok(wrapped)
  assert.equal(wrapped.events[0].id, '456')
  assert.equal(wrapped.week.number, 4)

  // Null or malformed input returns null
  assert.equal(fastly.parseResponse(null), null)
  assert.equal(fastly.parseResponse({}), null)
  assert.equal(fastly.parseResponse({ events: 'not-array' }), null)
})

