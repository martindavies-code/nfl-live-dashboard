import test from 'node:test'
import assert from 'node:assert/strict'
import { getGameBroadcastDetails } from './broadcastInfo.ts'

function game(away, home, { week = 4, season = 2026, date, network, venue, name } = {}) {
  return {
    name: name ?? `${away} at ${home}`,
    date,
    season: { year: season, type: 2 },
    week: { number: week },
    competitions: [
      {
        venue,
        broadcasts: network ? [{ names: [network] }] : undefined,
        competitors: [
          { homeAway: 'away', team: { abbreviation: away } },
          { homeAway: 'home', team: { abbreviation: home } },
        ],
      },
    ],
  }
}

const NAMES_NEVER_GUESSED = [
  'Joe Buck', 'Troy Aikman', 'Mike Tirico', 'Cris Collinsworth', 'Jim Nantz', 'J.J. Watt',
  'Ian Eagle', 'Charles Davis', 'Kevin Burkhardt', 'Tom Brady', 'Joe Davis', 'Greg Olsen',
  'Al Michaels', 'Kirk Herbstreit', 'Rich Eisen', 'Kurt Warner', 'Tony Romo',
]

function assertTba(info) {
  assert.equal(info.announcers.verified, false)
  assert.equal(info.announcers.leadDuo, 'Crew TBA')
  assert.equal(info.announcers.playByPlay, 'TBA')
  assert.equal(info.announcers.sideline, undefined)
  assert.deepEqual(info.announcers.sources, [])
  for (const n of NAMES_NEVER_GUESSED) {
    assert.ok(!info.announcers.fullCrew.includes(n), `${n} must not be guessed for an unverified game`)
  }
}

// ---------------------------------------------------------------------------
// Network / UK coverage (unchanged behaviour) — announcers are TBA when unverified
// ---------------------------------------------------------------------------

test('Broadcast: Monday Night Football resolves ESPN / ABC, Sky Sports & Channel 5 — permanent crew Joe Buck & Troy Aikman', () => {
  const info = getGameBroadcastDetails(
    game('PHI', 'CHI', { week: 99, date: '2026-09-29T00:15:00Z', network: 'ESPN, ABC', name: 'Eagles at Bears' })
  )
  assert.equal(info.usTv, 'ESPN / ABC')
  assert.ok(info.ukTv.includes('Sky Sports NFL'))
  assert.ok(info.ukTv.includes('Channel 5'))
  assert.ok(info.ukRadio.includes('talkSPORT 2'))
  assert.equal(info.announcers.leadDuo, 'Joe Buck & Troy Aikman')
  assert.equal(info.announcers.sideline, 'Lisa Salters')
  assert.equal(info.announcers.verified, true)
})

test('Broadcast: Sunday Night Football resolves NBC, Sky Sports Main Event — permanent crew Mike Tirico & Cris Collinsworth', () => {
  const info = getGameBroadcastDetails(
    game('KC', 'BAL', { week: 99, date: '2026-10-05T00:20:00Z', network: 'NBC', name: 'Chiefs at Ravens' })
  )
  assert.equal(info.usTv, 'NBC')
  assert.ok(info.ukTv.includes('Sky Sports NFL'))
  assert.ok(info.ukRadio.includes('talkSPORT'))
  assert.equal(info.announcers.leadDuo, 'Mike Tirico & Cris Collinsworth')
  assert.equal(info.announcers.sideline, 'Melissa Stark')
  assert.equal(info.announcers.verified, true)
})

test('Broadcast: Thursday Night Football resolves Amazon Prime Video — permanent crew Al Michaels & Kirk Herbstreit', () => {
  const info = getGameBroadcastDetails(
    game('MIA', 'BUF', { week: 99, date: '2026-10-02T00:15:00Z', network: 'Amazon Prime Video', name: 'Dolphins at Bills' })
  )
  assert.equal(info.usTv, 'Amazon Prime Video')
  assert.ok(info.ukTv.includes('Prime Video UK'))
  assert.equal(info.announcers.leadDuo, 'Al Michaels & Kirk Herbstreit')
  assert.equal(info.announcers.sideline, 'Kaylee Hartung')
  assert.equal(info.announcers.verified, true)
})

test('Broadcast: Thursday games on CBS or FOX (Thanksgiving) NEVER guess Al Michaels — stay Crew TBA', () => {
  // Thanksgiving 4:30pm ET (21:30 UK) / 6:30pm ET (23:30 UK) on CBS/FOX
  const cbsThursday = getGameBroadcastDetails(
    game('CHI', 'DET', { week: 99, date: '2026-11-26T21:30:00Z', network: 'CBS', name: 'Bears at Lions' })
  )
  assert.equal(cbsThursday.usTv, 'CBS')
  assertTba(cbsThursday)

  const foxThursday = getGameBroadcastDetails(
    game('NYG', 'DAL', { week: 99, date: '2026-11-26T23:30:00Z', network: 'FOX', name: 'Giants at Cowboys' })
  )
  assert.equal(foxThursday.usTv, 'FOX')
  assertTba(foxThursday)
})

test('Broadcast: Thursday Night NFL Kickoff game on NBC resolves Mike Tirico & Cris Collinsworth', () => {
  const nbcKickoff = getGameBroadcastDetails(
    game('BAL', 'KC', { week: 99, date: '2026-09-11T00:20:00Z', network: 'NBC', name: 'Ravens at Chiefs' })
  )
  assert.equal(nbcKickoff.usTv, 'NBC')
  assert.equal(nbcKickoff.announcers.leadDuo, 'Mike Tirico & Cris Collinsworth')
  assert.equal(nbcKickoff.announcers.verified, true)
})

test('Broadcast: London Games resolve Channel 5 (Free-to-Air) & Sky Sports, talkSPORT 2 — crew stays TBA unless verified', () => {
  const info = getGameBroadcastDetails(
    game('NYJ', 'MIN', {
      week: 99,
      date: '2026-10-06T13:30:00Z',
      network: 'NFL Network',
      venue: { fullName: 'Tottenham Hotspur Stadium', address: { city: 'London' } },
    })
  )
  assert.equal(info.usTv, 'NFL Network')
  assert.ok(info.ukTv.includes('Channel 5'))
  assert.ok(info.ukTv.includes('Sky Sports'))
  assert.ok(info.ukRadio.includes('talkSPORT 2'))
  assert.ok(info.ukPundits.includes('Dermot O\'Leary') || info.ukPundits.includes('Osi Umenyiora'))
  assertTba(info)
})

test('Broadcast: Super Bowl resolves dual Sky & Channel 5, dual BBC & talkSPORT — crew stays TBA unless verified', () => {
  const info = getGameBroadcastDetails({
    name: 'Super Bowl LXI',
    date: '2027-02-14T23:30:00Z',
    season: { year: 2026, type: 3 },
    week: { number: 5 },
    competitions: [
      {
        competitors: [
          { homeAway: 'away', team: { abbreviation: 'KC' } },
          { homeAway: 'home', team: { abbreviation: 'DET' } },
        ],
      },
    ],
  })
  assert.ok(info.ukTv.includes('Channel 5'))
  assert.ok(info.ukTv.includes('Sky Sports'))
  assert.ok(info.ukRadio.includes('BBC Radio 5 Live'))
  assert.ok(info.ukRadio.includes('talkSPORT'))
  assertTba(info)
})

test('Broadcast: marquee teams / late windows / network brand NEVER imply a star crew', () => {
  // These are exactly the heuristics that produced wrong crews (e.g. Nantz & Watt on TEN@BAL,
  // Burkhardt & Brady on GB@TB). With no verified entry the answer is always TBA.
  const cbsLate = getGameBroadcastDetails(
    game('KC', 'BUF', { week: 99, date: '2026-10-18T20:25:00Z', network: 'CBS' })
  )
  assert.equal(cbsLate.usTv, 'CBS')
  assertTba(cbsLate)

  const foxLate = getGameBroadcastDetails(
    game('DAL', 'SF', { week: 99, date: '2026-10-04T20:25:00Z', network: 'FOX' })
  )
  assert.equal(foxLate.usTv, 'FOX')
  assert.ok(foxLate.ukTv.includes('Sky Sports'))
  assertTba(foxLate)

  // Tier-1 home team in a week that has no verified entry
  assertTba(getGameBroadcastDetails(game('TEN', 'BAL', { week: 5, network: 'CBS' })))
})

test('Broadcast: Null and empty event handling is fully resilient and never crashes', () => {
  const empty = getGameBroadcastDetails(null)
  assert.ok(empty.ukTv)
  assert.ok(empty.ukRadio)
  assert.equal(empty.announcers.leadDuo, 'Crew TBA')
  assert.equal(empty.announcers.verified, false)

  const emptyObj = getGameBroadcastDetails({})
  assert.ok(emptyObj.ukTv)
  assert.ok(emptyObj.ukRadio)
  assert.equal(emptyObj.announcers.verified, false)
})

// ---------------------------------------------------------------------------
// Fact-check: 2026 Week 4. Independent literal table (do not derive from the registry).
// Sources: Yahoo Sports / Akron Beacon Journal Week 4 announcer pairings (Sunday + SNF + London),
// plus corroborated reports for TNF and MNF.
// ---------------------------------------------------------------------------

const WEEK4 = [
  // away, home, network, play-by-play, analyst(s), sideline
  ['PIT', 'CLE', 'Amazon Prime Video', 'Al Michaels', 'Kirk Herbstreit', 'Kaylee Hartung'],
  ['IND', 'WSH', 'NFL Network', 'Dave Pasch', 'Kurt Warner & Jason Kelce', 'Molly McGrath'],
  ['TEN', 'BAL', 'CBS', 'Chris Lewis', 'Luke Kuechly', 'Amanda Balionis'],
  ['NE', 'BUF', 'CBS', 'Ian Eagle', 'Ross Tucker', 'Evan Washburn'],
  ['NYJ', 'CHI', 'FOX', 'Tim Brando', 'Drew Brees', 'Kristina Pink'],
  ['JAX', 'CIN', 'CBS', 'Tom McCarthy', 'Robert Turbin', 'Tiffany Blackmon'],
  ['DAL', 'HOU', 'FOX', 'Kenny Albert', 'Greg Olsen', 'Pam Oliver'],
  ['ARI', 'NYG', 'CBS', 'Spero Dedes', 'Adam Archuleta', 'Aditi Kinkhabwala'],
  ['LAR', 'PHI', 'FOX', 'Kevin Burkhardt', 'Tom Brady', 'Erin Andrews & Tom Rinaldi'],
  ['GB', 'TB', 'FOX', 'Chris Myers', 'Jonathan Vilma', 'Jen Hale'],
  ['MIA', 'MIN', 'FOX', 'Kevin Kugler', 'Daryl Johnston', 'Allison Williams'],
  ['KC', 'LV', 'CBS', 'Jim Nantz', 'J.J. Watt', 'Tracy Wolfson'],
  ['LAC', 'SEA', 'CBS', 'Andrew Catalon', 'Logan Ryan', 'AJ Ross'],
  ['DEN', 'SF', 'CBS', 'Kevin Harlan', 'Trent Green', 'Melanie Collins'],
  ['DET', 'CAR', 'NBC', 'Mike Tirico', 'Cris Collinsworth', 'Melissa Stark & Kaylee Hartung'],
  ['ATL', 'NO', 'ESPN / ABC', 'Joe Buck', 'Troy Aikman', 'Lisa Salters & Laura Rutledge'],
]

test('Broadcast Fact-Check: all 16 Week 4 games resolve their exact verified crews', () => {
  for (const [away, home, network, pbp, analyst, sideline] of WEEK4) {
    const info = getGameBroadcastDetails(game(away, home))
    const label = `${away}@${home}`
    assert.equal(info.announcers.verified, true, `${label} should be verified`)
    assert.equal(info.usTv, network, `${label} network`)
    assert.equal(info.announcers.playByPlay, pbp, `${label} play-by-play`)
    assert.equal(info.announcers.analyst, analyst, `${label} analyst`)
    assert.equal(info.announcers.sideline, sideline, `${label} sideline`)
    assert.ok(info.announcers.sources.length > 0, `${label} must cite a source`)
    assert.match(info.announcers.verifiedOn, /^\d{4}-\d{2}-\d{2}$/)
  }
})

test('Broadcast Fact-Check: London Series (IND@WSH) shows the three-man booth and Channel 5/Sky Sports coverage', () => {
  const info = getGameBroadcastDetails(
    game('IND', 'WSH', {
      network: 'NFL Net',
      venue: { fullName: 'Tottenham Hotspur Stadium', address: { city: 'London' } },
    })
  )
  assert.equal(info.announcers.leadDuo, 'Dave Pasch, Kurt Warner & Jason Kelce')
  assert.equal(info.announcers.fullCrew, 'Dave Pasch, Kurt Warner, Jason Kelce, Molly McGrath')
  assert.equal(info.usTv, 'NFL Network')
  assert.ok(info.ukTv.includes('Channel 5'))
  assert.ok(info.ukTv.includes('Sky Sports NFL'))
  assert.ok(info.ukRadio.includes('talkSPORT 2'))
})

test('Broadcast Fact-Check: marquee-team regressions from the Yahoo list stay correct', () => {
  // TEN@BAL: BAL is a "tier 1" team but this is NOT the Nantz/Watt game.
  assert.equal(getGameBroadcastDetails(game('TEN', 'BAL')).announcers.leadDuo, 'Chris Lewis & Luke Kuechly')
  // DAL@HOU: not Burkhardt & Brady.
  assert.equal(getGameBroadcastDetails(game('DAL', 'HOU')).announcers.leadDuo, 'Kenny Albert & Greg Olsen')
  // MIA@MIN at 4:05pm ET: not Burkhardt & Brady either.
  assert.equal(getGameBroadcastDetails(game('MIA', 'MIN')).announcers.leadDuo, 'Kevin Kugler & Daryl Johnston')
  // Only KC@LV has Nantz & Watt; only LAR@PHI has Burkhardt & Brady.
  const all = WEEK4.map(([a, h]) => getGameBroadcastDetails(game(a, h)).announcers.leadDuo)
  assert.equal(all.filter((d) => d.includes('Jim Nantz')).length, 1)
  assert.equal(all.filter((d) => d.includes('Kevin Burkhardt')).length, 1)
})

test('Broadcast Fact-Check: lookup is strict — week, season and matchup must all match', () => {
  // Same teams, different week => TBA (a crew never carries over to another week).
  assertTba(getGameBroadcastDetails(game('KC', 'LV', { week: 9 })))
  // Same teams, different season => TBA.
  assertTba(getGameBroadcastDetails(game('KC', 'LV', { season: 2027 })))
  // Missing week/season data => TBA, never a loose name match.
  assertTba(getGameBroadcastDetails({ name: 'Kansas City Chiefs at Las Vegas Raiders', competitions: game('KC', 'LV').competitions }))
  // Reversed home/away is a different game (and different venue) but same pairing key;
  // still resolved by pairing within the same week.
  assert.equal(getGameBroadcastDetails(game('LV', 'KC')).announcers.verified, true)
  // A different pairing in the same week => TBA.
  assertTba(getGameBroadcastDetails(game('KC', 'DEN')))
})

test('Broadcast Fact-Check: Patriots display abbreviation (FNE) resolves the same verified crew as NE', () => {
  const viaFne = getGameBroadcastDetails(game('FNE', 'BUF'))
  const viaNe = getGameBroadcastDetails(game('NE', 'BUF'))
  assert.equal(viaFne.announcers.leadDuo, 'Ian Eagle & Ross Tucker')
  assert.deepEqual(viaFne.announcers, viaNe.announcers)
})

test('Broadcast Fact-Check: Concurrent late CBS games (KC@LV and LAC@SEA) have distinct crews and never share Jim Nantz & J.J. Watt', () => {
  const kcAtLv = getGameBroadcastDetails(game('KC', 'LV', { date: '2026-10-04T20:25:00Z' }))
  const lacAtSea = getGameBroadcastDetails(game('LAC', 'SEA', { date: '2026-10-04T20:25:00Z' }))
  const denAtSf = getGameBroadcastDetails(game('DEN', 'SF', { date: '2026-10-04T20:25:00Z' }))

  // KC@LV has Jim Nantz & J.J. Watt
  assert.equal(kcAtLv.announcers.leadDuo, 'Jim Nantz & J.J. Watt')
  assert.equal(kcAtLv.announcers.sideline, 'Tracy Wolfson')
  assert.equal(kcAtLv.announcers.verified, true)

  // LAC@SEA has Andrew Catalon & Logan Ryan (NOT Jim Nantz or J.J. Watt)
  assert.equal(lacAtSea.announcers.leadDuo, 'Andrew Catalon & Logan Ryan')
  assert.equal(lacAtSea.announcers.sideline, 'AJ Ross')
  assert.equal(lacAtSea.announcers.verified, true)
  assert.ok(!lacAtSea.announcers.fullCrew.includes('Jim Nantz'), 'LAC@SEA must not have Jim Nantz')
  assert.ok(!lacAtSea.announcers.fullCrew.includes('J.J. Watt'), 'LAC@SEA must not have J.J. Watt')

  // DEN@SF has Kevin Harlan & Trent Green
  assert.equal(denAtSf.announcers.leadDuo, 'Kevin Harlan & Trent Green')
  assert.equal(denAtSf.announcers.sideline, 'Melanie Collins')
  assert.equal(denAtSf.announcers.verified, true)

  // Invariant: all 3 simultaneous CBS games have completely distinct announcer booths
  const crews = [kcAtLv.announcers.leadDuo, lacAtSea.announcers.leadDuo, denAtSf.announcers.leadDuo]
  assert.equal(new Set(crews).size, 3)
})
