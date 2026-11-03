import test from 'node:test'
import assert from 'node:assert/strict'
import { getGameHighlightInfo } from './gameHighlights.ts'

test('gameHighlights: getGameHighlightInfo defensively handles nullish and empty events', () => {
  const nullResult = getGameHighlightInfo(null)
  assert.equal(typeof nullResult.url, 'string')
  assert.ok(nullResult.url.startsWith('https://www.youtube.com/@nfl/search?query='))
  assert.equal(nullResult.isDirect, false)
  assert.equal(nullResult.label, 'Watch Highlights')
  assert.equal(nullResult.channelUrl, 'https://www.youtube.com/@nfl')

  const emptyEventResult = getGameHighlightInfo({ id: 'empty' })
  assert.equal(emptyEventResult.isDirect, false)
  assert.ok(emptyEventResult.url.includes('https://www.youtube.com/@nfl'))
})

test('gameHighlights: resolves exact verified YouTube highlight link for registered games', () => {
  // User reference game: Chicago Bears vs Seattle Seahawks Week 8
  const bearsSeahawksEvent = {
    id: '401772648',
    season: { year: 2026, type: 2 },
    week: { number: 8 },
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            team: { id: '26', displayName: 'Seattle Seahawks', name: 'Seahawks', abbreviation: 'SEA' },
          },
          {
            homeAway: 'away',
            team: { id: '3', displayName: 'Chicago Bears', name: 'Bears', abbreviation: 'CHI' },
          },
        ],
      },
    ],
  }

  const info = getGameHighlightInfo(bearsSeahawksEvent)
  assert.equal(info.isDirect, true)
  assert.equal(info.videoId, 'j8XRNpYOsos')
  assert.equal(info.url, 'https://www.youtube.com/watch?v=j8XRNpYOsos')
  assert.equal(info.thumbnailUrl, 'https://i.ytimg.com/vi/j8XRNpYOsos/hqdefault.jpg')
  assert.ok(info.title.includes('Chicago Bears vs Seattle Seahawks'))
})

test('gameHighlights: resolves fallback search scoped to official @nfl YouTube channel for unregistered games', () => {
  const futureEvent = {
    id: 'future-game',
    season: { year: 2026, type: 2 },
    week: { number: 9 },
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            team: { id: '1', displayName: 'Baltimore Ravens', name: 'Ravens', abbreviation: 'BAL' },
          },
          {
            homeAway: 'away',
            team: { id: '2', displayName: 'Jacksonville Jaguars', name: 'Jaguars', abbreviation: 'JAX' },
          },
        ],
      },
    ],
  }

  const info = getGameHighlightInfo(futureEvent)
  assert.equal(info.isDirect, false)
  assert.equal(info.videoId, undefined)
  assert.equal(info.thumbnailUrl, undefined)
  assert.ok(info.url.startsWith('https://www.youtube.com/@nfl/search?query='))
  // Verifies the query targets the official NFL channel for the exact matchup
  assert.ok(info.url.includes('Jacksonville%20Jaguars'))
  assert.ok(info.url.includes('Baltimore%20Ravens'))
  assert.ok(info.url.includes('Game%20Highlights'))
})

test('gameHighlights: handles postseason games and Patriots name sanitization', () => {
  const playoffEvent = {
    id: 'postseason-game',
    season: { year: 2026, type: 3 },
    week: { number: 1 },
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            team: { id: '15', displayName: 'Miami Dolphins', abbreviation: 'MIA' },
          },
          {
            homeAway: 'away',
            team: { id: '17', displayName: 'New England Patriots', abbreviation: 'FNE' },
          },
        ],
      },
    ],
  }

  const info = getGameHighlightInfo(playoffEvent)
  assert.equal(info.isDirect, false)
  assert.ok(info.url.includes('Playoffs'))
  assert.ok(info.title.includes('Highlights'))

  // Event with missing competitors fallback
  const sparseEvent = {
    competitions: [{ competitors: [] }],
  }
  const sparseInfo = getGameHighlightInfo(sparseEvent)
  assert.equal(sparseInfo.isDirect, false)
  assert.ok(sparseInfo.url.includes('AWAY'))
})
