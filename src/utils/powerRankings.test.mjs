import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTeamPowerRank,
  getTeamPowerRankDetail,
  getMatchupPowerScore,
  getBestMatchupByPowerRanking,
  getMatchupTierInfo,
  getPowerRankTierStyle,
  getLatestPowerRankingsEdition,
  getWeeklyPowerRankingsEdition,
  getEventKickoffMs,
} from './powerRankings.ts'

function mockGame(awayAbbr, homeAbbr, options = {}) {
  const { state = 'in', isHalftime = false, id = `${awayAbbr}-${homeAbbr}`, date } = options
  return {
    id,
    date,
    name: `${awayAbbr} at ${homeAbbr}`,
    status: {
      type: {
        state,
        detail: isHalftime ? 'Halftime' : state === 'in' ? 'Q2 04:30' : 'Scheduled',
        shortDetail: isHalftime ? 'Half' : undefined,
      },
    },
    competitions: [
      {
        date,
        status: {
          type: { state },
        },
        situation: isHalftime
          ? { down: -1, isRedZone: false }
          : { down: 1, distance: 10, yardLine: 25 },
        competitors: [
          { homeAway: 'home', team: { abbreviation: homeAbbr, name: homeAbbr } },
          { homeAway: 'away', team: { abbreviation: awayAbbr, name: awayAbbr } },
        ],
      },
    ],
  }
}

test('Power Rankings: getTeamPowerRank accurately scores known teams and aliases across published editions', () => {
  // Current Authoritative Edition (Week 9)
  assert.equal(getTeamPowerRank('BUF'), 1)
  assert.equal(getTeamPowerRank('SF'), 2)
  assert.equal(getTeamPowerRank('DET'), 3)
  assert.equal(getTeamPowerRank('DEN'), 5)
  assert.equal(getTeamPowerRank('KC'), 8)
  assert.equal(getTeamPowerRank('NYG'), 15)
  assert.equal(getTeamPowerRank('IND'), 32)
  assert.equal(getTeamPowerRank('NE'), 11)
  assert.equal(getTeamPowerRank('FNE'), 11) // Alias
  assert.equal(getTeamPowerRank('UNKNOWN'), 20)

  // Explicit Week 8 published rankings edition
  assert.equal(getTeamPowerRank('KC', 8), 3)
  assert.equal(getTeamPowerRank('DET', 8), 4)
  assert.equal(getTeamPowerRank('BUF', 8), 1)
  assert.equal(getTeamPowerRank('CAR', 8), 25)
  assert.equal(getTeamPowerRank('NE', 8), 11)
  assert.equal(getTeamPowerRank('FNE', 8), 11)
})

test('Power Rankings: getTeamPowerRankDetail returns full provenance, change, and source metadata', () => {
  const detail = getTeamPowerRankDetail('DEN')
  assert.equal(detail.rank, 5)
  assert.equal(detail.previousRank, 7)
  assert.equal(detail.change, 2)
  assert.ok(detail.source.publisher.includes('Yahoo Sports'))
  assert.ok(detail.source.url.startsWith('https://'))

  const latest = getLatestPowerRankingsEdition()
  assert.equal(latest.week, 9)
  assert.equal(latest.season, 2026)

  const w8 = getWeeklyPowerRankingsEdition(8)
  assert.equal(w8.week, 8)
  assert.equal(w8.season, 2026)
})

test('Power Rankings: getPowerRankTierStyle assigns distinct visual styling tokens across tiers', () => {
  const top5 = getPowerRankTierStyle(1)
  assert.equal(top5.tierLabel, 'Top 5 Elite')
  assert.ok(top5.badgeClass.includes('amber'))

  const top10 = getPowerRankTierStyle(8)
  assert.equal(top10.tierLabel, 'Top 10 Contender')
  assert.ok(top10.badgeClass.includes('sky'))

  const playoff = getPowerRankTierStyle(14)
  assert.equal(playoff.tierLabel, 'Playoff Hunt')
  assert.ok(playoff.badgeClass.includes('indigo'))

  const mid = getPowerRankTierStyle(20)
  assert.equal(mid.tierLabel, 'Mid Tier')

  const rebuilding = getPowerRankTierStyle(30)
  assert.equal(rebuilding.tierLabel, 'Rebuilding')
})

test('Power Rankings: getMatchupPowerScore ranks top-tier clashes higher than bottom-tier', () => {
  const premierMatchup = mockGame('BUF', 'SF')  // #1 vs #2 = ~3
  const midMatchup = mockGame('PIT', 'DAL')     // #13 vs #20 = ~33
  const lowMatchup = mockGame('LAC', 'IND')     // #31 vs #32 = ~63

  const scorePremier = getMatchupPowerScore(premierMatchup)
  const scoreMid = getMatchupPowerScore(midMatchup)
  const scoreLow = getMatchupPowerScore(lowMatchup)

  assert.ok(scorePremier < scoreMid, 'Premier matchup must have lower score than mid matchup')
  assert.ok(scoreMid < scoreLow, 'Mid matchup must have lower score than low matchup')
})

test('Power Rankings: Spotlight NYG if they are currently live (not at HT)', () => {
  const nygLive = mockGame('DAL', 'NYG', { state: 'in', isHalftime: false, id: 'nyg-live' })
  const premierLive = mockGame('BUF', 'SF', { state: 'in', isHalftime: false, id: 'buf-sf' })
  const billsLive = mockGame('DET', 'KC', { state: 'in', isHalftime: false, id: 'det-kc' })

  // NYG live takes priority
  const spotlight = getBestMatchupByPowerRanking([premierLive, nygLive, billsLive])
  assert.equal(spotlight?.id, 'nyg-live', 'NYG must be spotlighted when live and not at halftime')
})

test('Power Rankings: If NYG is at Halftime, spotlight the best matchup by power ranking', () => {
  const nygAtHalftime = mockGame('DAL', 'NYG', { state: 'in', isHalftime: true, id: 'nyg-ht' })
  const premierLive = mockGame('BUF', 'SF', { state: 'in', isHalftime: false, id: 'buf-sf' }) // Best matchup
  const midLive = mockGame('MIA', 'NYJ', { state: 'in', isHalftime: false, id: 'mia-nyj' })

  const spotlight = getBestMatchupByPowerRanking([midLive, nygAtHalftime, premierLive])
  assert.equal(spotlight?.id, 'buf-sf', 'When NYG is at HT, best live matchup by power ranking must be spotlighted')
})

test('Power Rankings: If NYG is not live, spotlight best matchup by power ranking', () => {
  const nygPregame = mockGame('DAL', 'NYG', { state: 'pre', id: 'nyg-pre' })
  const premierLive = mockGame('BUF', 'SF', { state: 'in', id: 'buf-sf' }) // 1 + 2 = 3
  const midLive = mockGame('MIN', 'HOU', { state: 'in', id: 'min-hou' }) // 7 + 24 = 31

  const spotlight = getBestMatchupByPowerRanking([midLive, nygPregame, premierLive])
  assert.equal(spotlight?.id, 'buf-sf', 'Premier live matchup must be spotlighted when NYG is not live')
})

test('Power Rankings: Pre-game week spotlights best matchup by power ranking when dates are identical', () => {
  const game1 = mockGame('BUF', 'SF', { state: 'pre', id: 'buf-sf' }) // 1 + 2 = 3
  const game2 = mockGame('TEN', 'IND', { state: 'pre', id: 'ten-ind' }) // 28 + 32 = 60
  const game3 = mockGame('DET', 'KC', { state: 'pre', id: 'det-kc' }) // 3 + 8 = 11

  const spotlight = getBestMatchupByPowerRanking([game2, game3, game1])
  assert.equal(spotlight?.id, 'buf-sf', 'Best matchup by power ranking in pregame week must be spotlighted')
})

test('Power Rankings: When no games are in progress, default to the next game to take place', () => {
  // Monday Night Game (earliest upcoming game)
  const mondayGame = mockGame('DAL', 'GB', {
    state: 'pre',
    id: 'dal-gb',
    date: '2026-10-19T00:20:00Z',
  }) // DAL (20) vs GB (14) = 34.14
  // Tuesday Night Game (later, but higher power ranked teams)
  const tuesdayGame = mockGame('BUF', 'SF', {
    state: 'pre',
    id: 'buf-sf',
    date: '2026-10-20T00:15:00Z',
  }) // BUF (1) vs SF (2) = 3.01

  const spotlight = getBestMatchupByPowerRanking([tuesdayGame, mondayGame])
  assert.equal(spotlight?.id, 'dal-gb', 'Must spotlight Monday game because it is the next game to take place')
})

test('Power Rankings: If multiple games are scheduled at the same time next, spotlight highest ranked teams', () => {
  const sundaySlot = '2026-10-18T17:00:00Z'
  const earlyHighRank = mockGame('BUF', 'SF', {
    state: 'pre',
    id: 'buf-sf-early',
    date: sundaySlot,
  }) // 1 + 2 = 3
  const earlyLowRank = mockGame('LAC', 'IND', {
    state: 'pre',
    id: 'lac-ind-early',
    date: sundaySlot,
  }) // 31 + 32 = 63
  const lateGame = mockGame('DET', 'KC', {
    state: 'pre',
    id: 'det-kc-late',
    date: '2026-10-18T20:25:00Z',
  }) // 3 + 8 = 11

  const spotlight = getBestMatchupByPowerRanking([lateGame, earlyLowRank, earlyHighRank])
  assert.equal(spotlight?.id, 'buf-sf-early', 'Must spotlight the highest ranked teams among the games kicking off next')
})

test('Power Rankings edge cases: empty, postgame slate, halftime-only, invalid dates, and fallbacks', () => {
  // Empty or non-array
  assert.equal(getBestMatchupByPowerRanking(null), null)
  assert.equal(getBestMatchupByPowerRanking([]), null)

  // getTeamPowerRank edge cases
  assert.equal(getTeamPowerRank(), 20)
  assert.equal(getTeamPowerRank(''), 20)
  assert.equal(getTeamPowerRank('  buf  '), 1)
  assert.equal(getTeamPowerRank('  kc  '), 8)
  assert.equal(getTeamPowerRank('  kc  ', 8), 3)

  // getMatchupPowerScore edge cases with missing competitors
  const emptyEvent = { id: 'empty' }
  assert.ok(getMatchupPowerScore(emptyEvent) > 0)

  const halfCompetitorEvent = {
    id: 'half-comp',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: {} },
        { homeAway: 'away' },
      ],
    }],
  }
  assert.ok(getMatchupPowerScore(halfCompetitorEvent) > 0)

  // All games completed (post-game slate)
  const postGame1 = mockGame('LAC', 'IND', { state: 'post', id: 'lac-ind-post' }) // 31 + 32 = 63
  const postGame2 = mockGame('BUF', 'SF', { state: 'post', id: 'buf-sf-post' })    // 1 + 2 = 3
  const spotlightPost = getBestMatchupByPowerRanking([postGame1, postGame2])
  assert.equal(spotlightPost?.id, 'buf-sf-post')

  // Only halftime games in progress
  const htGame1 = mockGame('LAC', 'IND', { state: 'in', isHalftime: true, id: 'lac-ind-ht' })
  const htGame2 = mockGame('BUF', 'SF', { state: 'in', isHalftime: true, id: 'buf-sf-ht' })
  const spotlightHt = getBestMatchupByPowerRanking([htGame1, htGame2])
  assert.equal(spotlightHt?.id, 'buf-sf-ht')

  // Fallback on non-standard states
  const unknown1 = { id: 'unk-1', status: { type: { state: 'unknown' } } }
  const unknown2 = { id: 'unk-2', status: { type: { state: 'unknown' } } }
  assert.equal(getBestMatchupByPowerRanking([unknown1, unknown2])?.id, 'unk-1')

  // Pregame games with invalid kickoff dates fallback to matchup power score
  const invalidDatePre1 = mockGame('LAC', 'IND', { state: 'pre', id: 'inv-date-1', date: 'invalid-date' })
  const invalidDatePre2 = mockGame('BUF', 'SF', { state: 'pre', id: 'inv-date-2', date: 'invalid-date' })
  const spotlightInv = getBestMatchupByPowerRanking([invalidDatePre1, invalidDatePre2])
  assert.equal(spotlightInv?.id, 'inv-date-2')

  // Game with competition date only and competition status only
  const compDateOnlyGame = {
    id: 'comp-date-only',
    competitions: [{ date: '2026-10-25T17:00:00Z', status: { type: { state: 'pre' } } }],
  }
  const spotlightCompDate = getBestMatchupByPowerRanking([compDateOnlyGame])
  assert.equal(spotlightCompDate?.id, 'comp-date-only')

  // Game with neither status nor competition status (defaults to 'pre')
  const noStatusGame = { id: 'no-status-1', competitions: [] }
  assert.equal(getBestMatchupByPowerRanking([noStatusGame])?.id, 'no-status-1')

  // NYG live game with status on competition only and situation
  const nygCompLive = {
    id: 'nyg-comp-live',
    competitions: [{
      status: { type: { state: 'in' } },
      competitors: [{ team: { abbreviation: 'NYG' } }, { team: { abbreviation: 'DAL' } }],
    }],
  }
  assert.equal(getBestMatchupByPowerRanking([nygCompLive])?.id, 'nyg-comp-live')

  // NYG pre-game does not trigger priority when not live
  const nygPreGame = mockGame('DAL', 'NYG', { state: 'pre', id: 'nyg-pre-only' })
  const spotlightNygPre = getBestMatchupByPowerRanking([nygPreGame])
  assert.equal(spotlightNygPre?.id, 'nyg-pre-only')
})

test('Power Rankings: getEventKickoffMs robustly handles dates, nullish values, and invalid formats', () => {
  assert.equal(getEventKickoffMs({ id: 'no-date' }), Infinity)
  assert.equal(getEventKickoffMs({ id: 'invalid-date', date: 'not-a-date' }), Infinity)
  assert.equal(getEventKickoffMs({ id: 'valid', date: '2026-10-25T17:00:00Z' }), new Date('2026-10-25T17:00:00Z').getTime())
  assert.equal(getEventKickoffMs({ id: 'comp-date', competitions: [{ date: '2026-10-25T17:00:00Z' }] }), new Date('2026-10-25T17:00:00Z').getTime())
})

test('Power Rankings: getMatchupTierInfo correctly categorizes matchup quality and tiers', () => {
  // Top-10 Heavyweight Clash (both <= 10)
  const top10 = getMatchupTierInfo(1, 4)
  assert.equal(top10.label, 'Top-10 Heavyweight Clash')
  assert.equal(top10.isMarquee, true)
  assert.ok(top10.badgeClass.includes('rose'))

  // Playoff Contender Battle (both <= 16, but not both <= 10)
  const playoff = getMatchupTierInfo(11, 14)
  assert.equal(playoff.label, 'Playoff Contender Battle')
  assert.equal(playoff.isMarquee, true)
  assert.ok(playoff.badgeClass.includes('indigo'))

  // Marquee Powerhouse Matchup (one team <= 5, opponent > 16)
  const marquee = getMatchupTierInfo(2, 22)
  assert.equal(marquee.label, 'Marquee Powerhouse Matchup')
  assert.equal(marquee.isMarquee, true)
  assert.ok(marquee.badgeClass.includes('amber'))

  // Competitive Showdown (neither in top 5, avg <= 16)
  const showdown = getMatchupTierInfo(15, 17) // avg = 16
  assert.equal(showdown.label, 'Competitive Showdown')
  assert.equal(showdown.isMarquee, false)
  assert.ok(showdown.badgeClass.includes('sky'))

  // Key Matchup (avg > 16)
  const keyMatchup = getMatchupTierInfo(25, 28)
  assert.equal(keyMatchup.label, 'Key Matchup')
  assert.equal(keyMatchup.isMarquee, false)
  assert.ok(keyMatchup.badgeClass.includes('slate'))
})
