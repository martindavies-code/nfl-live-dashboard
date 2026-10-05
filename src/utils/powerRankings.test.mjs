import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTeamPowerRank,
  getMatchupPowerScore,
  getBestMatchupByPowerRanking,
} from './powerRankings.ts'

function mockGame(awayAbbr, homeAbbr, options = {}) {
  const { state = 'in', isHalftime = false, id = `${awayAbbr}-${homeAbbr}` } = options
  return {
    id,
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

test('Power Rankings: getTeamPowerRank accurately scores known teams and aliases', () => {
  assert.equal(getTeamPowerRank('KC'), 1)
  assert.equal(getTeamPowerRank('DET'), 2)
  assert.equal(getTeamPowerRank('BAL'), 3)
  assert.equal(getTeamPowerRank('BUF'), 4)
  assert.equal(getTeamPowerRank('NYG'), 25)
  assert.equal(getTeamPowerRank('CAR'), 32)
  assert.equal(getTeamPowerRank('NE'), 30)
  assert.equal(getTeamPowerRank('FNE'), 30) // Alias
  assert.equal(getTeamPowerRank('UNKNOWN'), 20)
})

test('Power Rankings: getMatchupPowerScore ranks top-tier clashes higher than bottom-tier', () => {
  const premierMatchup = mockGame('KC', 'DET') // #1 vs #2 = ~3
  const midMatchup = mockGame('SEA', 'DAL')    // #16 vs #18 = ~34
  const lowMatchup = mockGame('TEN', 'CAR')    // #31 vs #32 = ~63

  const scorePremier = getMatchupPowerScore(premierMatchup)
  const scoreMid = getMatchupPowerScore(midMatchup)
  const scoreLow = getMatchupPowerScore(lowMatchup)

  assert.ok(scorePremier < scoreMid, 'Premier matchup must have lower score than mid matchup')
  assert.ok(scoreMid < scoreLow, 'Mid matchup must have lower score than low matchup')
})

test('Power Rankings: Spotlight NYG if they are currently live (not at HT)', () => {
  const nygLive = mockGame('DAL', 'NYG', { state: 'in', isHalftime: false, id: 'nyg-live' })
  const premierLive = mockGame('KC', 'DET', { state: 'in', isHalftime: false, id: 'kc-det' })
  const billsLive = mockGame('BUF', 'BAL', { state: 'in', isHalftime: false, id: 'buf-bal' })

  // Even though KC vs DET is the #1 power matchup, NYG is currently live and NOT at HT
  const spotlight = getBestMatchupByPowerRanking([premierLive, nygLive, billsLive])
  assert.equal(spotlight?.id, 'nyg-live', 'NYG must be spotlighted when live and not at halftime')
})

test('Power Rankings: If NYG is at Halftime, spotlight the best matchup by power ranking', () => {
  const nygAtHalftime = mockGame('DAL', 'NYG', { state: 'in', isHalftime: true, id: 'nyg-ht' })
  const premierLive = mockGame('KC', 'DET', { state: 'in', isHalftime: false, id: 'kc-det' }) // Best matchup
  const midLive = mockGame('CHI', 'ARI', { state: 'in', isHalftime: false, id: 'chi-ari' })

  const spotlight = getBestMatchupByPowerRanking([midLive, nygAtHalftime, premierLive])
  assert.equal(spotlight?.id, 'kc-det', 'When NYG is at HT, best live matchup by power ranking must be spotlighted')
})

test('Power Rankings: If NYG is not live, spotlight best matchup by power ranking', () => {
  const nygPregame = mockGame('DAL', 'NYG', { state: 'pre', id: 'nyg-pre' })
  const premierLive = mockGame('KC', 'BUF', { state: 'in', id: 'kc-buf' }) // 1 + 4 = 5
  const midLive = mockGame('MIN', 'HOU', { state: 'in', id: 'min-hou' }) // 8 + 9 = 17

  const spotlight = getBestMatchupByPowerRanking([midLive, nygPregame, premierLive])
  assert.equal(spotlight?.id, 'kc-buf', 'Premier live matchup must be spotlighted when NYG is not live')
})

test('Power Rankings: Pre-game week spotlights best matchup by power ranking', () => {
  const game1 = mockGame('KC', 'BAL', { state: 'pre', id: 'kc-bal' }) // 1 + 3 = 4
  const game2 = mockGame('JAX', 'TEN', { state: 'pre', id: 'jax-ten' }) // 27 + 31 = 58
  const game3 = mockGame('PHI', 'SF', { state: 'pre', id: 'phi-sf' }) // 5 + 6 = 11

  const spotlight = getBestMatchupByPowerRanking([game2, game3, game1])
  assert.equal(spotlight?.id, 'kc-bal', 'Best matchup by power ranking in pregame week must be spotlighted')
})
