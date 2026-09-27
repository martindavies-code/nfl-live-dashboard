import test from 'node:test'
import assert from 'node:assert/strict'
import { getMockLiveGames } from './espnApi.ts'

test('getMockLiveGames returns 3 valid events', () => {
  const games = getMockLiveGames()
  assert.equal(games.length, 3)

  const chiefsBills = games[0]
  assert.equal(chiefsBills.shortName, 'KC @ BUF')
  assert.equal(chiefsBills.competitions[0].competitors.length, 2)

  const situation = chiefsBills.competitions[0].situation
  assert.ok(situation)
  assert.equal(typeof situation.yardLine, 'number')
  assert.equal(typeof situation.down, 'number')
  assert.ok(situation.lastPlay)
})

test('getMockLiveGames advances sequence across sequential calls', () => {
  const g1 = getMockLiveGames()
  const g2 = getMockLiveGames()

  const sit1 = g1[0].competitions[0].situation
  const sit2 = g2[0].competitions[0].situation

  assert.notEqual(sit1.lastPlay.id, sit2.lastPlay.id)
})
