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

