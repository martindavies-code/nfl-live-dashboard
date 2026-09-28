import test from 'node:test'
import assert from 'node:assert/strict'
import { getGameBroadcastDetails } from './broadcastInfo.ts'

test('Broadcast: Monday Night Football resolves Joe Buck, Troy Aikman, Sky Sports & Channel 5', () => {
  const mnfEvent = {
    name: 'Eagles at Bears',
    date: '2026-09-29T00:15:00Z', // Tue 1:15 AM UK
    competitions: [
      {
        broadcasts: [{ names: ['ESPN', 'ABC'] }],
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'PHI' } },
          { homeAway: 'home', team: { abbreviation: 'CHI' } },
        ],
      },
    ],
  }

  const info = getGameBroadcastDetails(mnfEvent)
  assert.equal(info.usTv, 'ESPN / ABC')
  assert.ok(info.ukTv.includes('Sky Sports NFL'))
  assert.ok(info.ukTv.includes('Channel 5'))
  assert.ok(info.ukRadio.includes('talkSPORT 2'))
  assert.equal(info.announcers.playByPlay, 'Joe Buck')
  assert.equal(info.announcers.analyst, 'Troy Aikman')
  assert.equal(info.announcers.sideline, 'Lisa Salters')
})

test('Broadcast: Sunday Night Football resolves Mike Tirico, Cris Collinsworth, Sky Sports Main Event', () => {
  const snfEvent = {
    name: 'Chiefs at Ravens',
    date: '2026-10-05T00:20:00Z', // Mon 1:20 AM UK
    competitions: [
      {
        broadcasts: [{ names: ['NBC'] }],
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'KC' } },
          { homeAway: 'home', team: { abbreviation: 'BAL' } },
        ],
      },
    ],
  }

  const info = getGameBroadcastDetails(snfEvent)
  assert.equal(info.usTv, 'NBC')
  assert.ok(info.ukTv.includes('Sky Sports NFL'))
  assert.ok(info.announcers.leadDuo.includes('Mike Tirico'))
  assert.ok(info.announcers.leadDuo.includes('Cris Collinsworth'))
  assert.ok(info.ukRadio.includes('talkSPORT'))
})

test('Broadcast: London Games resolve ITV1 (Free-to-Air), BBC Radio 5 Live, Rich Eisen & Kurt Warner', () => {
  const londonEvent = {
    name: 'Jets at Vikings',
    date: '2026-10-06T13:30:00Z', // Sun 2:30 PM UK
    competitions: [
      {
        venue: { fullName: 'Tottenham Hotspur Stadium', address: { city: 'London' } },
        broadcasts: [{ names: ['NFL Network'] }],
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'NYJ' } },
          { homeAway: 'home', team: { abbreviation: 'MIN' } },
        ],
      },
    ],
  }

  const info = getGameBroadcastDetails(londonEvent)
  assert.ok(info.ukTv.includes('ITV1'))
  assert.ok(info.ukRadio.includes('BBC Radio 5 Live'))
  assert.equal(info.announcers.playByPlay, 'Rich Eisen')
  assert.equal(info.announcers.analyst, 'Kurt Warner')
  assert.ok(info.ukPundits.includes('Craig Doyle'))
})

test('Broadcast: Super Bowl resolves dual Sky & ITV, dual BBC & talkSPORT, lead crew', () => {
  const sbEvent = {
    name: 'Super Bowl LXI',
    date: '2027-02-14T23:30:00Z',
    season: { type: 3 },
    week: { number: 5 },
    competitions: [
      {
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'KC' } },
          { homeAway: 'home', team: { abbreviation: 'DET' } },
        ],
      },
    ],
  }

  const info = getGameBroadcastDetails(sbEvent)
  assert.ok(info.ukTv.includes('ITV1'))
  assert.ok(info.ukTv.includes('Sky Sports'))
  assert.ok(info.ukRadio.includes('BBC Radio 5 Live'))
  assert.ok(info.ukRadio.includes('talkSPORT'))
  assert.ok(info.announcers.leadDuo.includes('Joe Buck') || info.announcers.leadDuo.includes('J.J. Watt') || info.announcers.leadDuo.includes('Tom Brady') || info.announcers.leadDuo.includes('Cris Collinsworth'))
})

test('Broadcast: CBS marquee late-window resolves Jim Nantz & J.J. Watt (Tony Romo on leave)', () => {
  const cbsEvent = {
    name: 'Chiefs at Bills',
    date: '2026-10-18T20:25:00Z', // Sun 9:25 PM UK (late marquee window)
    competitions: [
      {
        broadcasts: [{ names: ['CBS'] }],
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'KC' } },
          { homeAway: 'home', team: { abbreviation: 'BUF' } },
        ],
      },
    ],
  }

  const info = getGameBroadcastDetails(cbsEvent)
  assert.equal(info.usTv, 'CBS')
  assert.equal(info.announcers.playByPlay, 'Jim Nantz')
  assert.equal(info.announcers.analyst, 'J.J. Watt')
  assert.equal(info.announcers.leadDuo, 'Jim Nantz & J.J. Watt')
  assert.ok(!info.announcers.fullCrew.includes('Tony Romo'), 'Tony Romo must not be assigned to live CBS games')
})

test('Broadcast: FOX marquee late-window resolves Kevin Burkhardt & Tom Brady', () => {
  const foxEvent = {
    name: 'Cowboys at 49ers',
    date: '2026-10-04T20:25:00Z', // Sun 9:25 PM UK
    competitions: [
      {
        broadcasts: [{ names: ['FOX'] }],
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'DAL' } },
          { homeAway: 'home', team: { abbreviation: 'SF' } },
        ],
      },
    ],
  }

  const info = getGameBroadcastDetails(foxEvent)
  assert.equal(info.usTv, 'FOX')
  assert.equal(info.announcers.playByPlay, 'Kevin Burkhardt')
  assert.equal(info.announcers.analyst, 'Tom Brady')
  assert.ok(info.ukTv.includes('Sky Sports'))
})

test('Broadcast: Null and empty event handling is fully resilient and never crashes', () => {
  const empty = getGameBroadcastDetails(null)
  assert.ok(empty.ukTv)
  assert.ok(empty.ukRadio)
  assert.ok(empty.announcers.leadDuo)

  const emptyObj = getGameBroadcastDetails({})
  assert.ok(emptyObj.ukTv)
  assert.ok(emptyObj.ukRadio)
})
