import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateWinProbability, normalCdf, getBettingOddsInfo } from './winProbability.ts'

test('normalCdf computes standard Gaussian probabilities accurately', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-4)
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3)
  assert.ok(Math.abs(normalCdf(-1.96) - 0.025) < 1e-3)
  assert.equal(normalCdf(-10), 0)
  assert.equal(normalCdf(10), 1)
})

test('Post-game: returns 100/0 for home win and 0/100 for away win', () => {
  const homeComp = { id: '1', score: '24', team: { displayName: 'Kansas City Chiefs', abbreviation: 'KC' } }
  const awayComp = { id: '2', score: '20', team: { displayName: 'Buffalo Bills', abbreviation: 'BUF' } }

  const resHomeWin = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'post',
  })
  assert.equal(resHomeWin.homePct, 100)
  assert.equal(resHomeWin.awayPct, 0)
  assert.equal(resHomeWin.favoredName, 'Kansas City Chiefs')
  assert.equal(resHomeWin.modelSource, 'Final')

  const resAwayWin = calculateWinProbability({
    homeCompetitor: { ...homeComp, score: '17' },
    awayCompetitor: { ...awayComp, score: '28' },
    gameState: 'post',
  })
  assert.equal(resAwayWin.homePct, 0)
  assert.equal(resAwayWin.awayPct, 100)
  assert.equal(resAwayWin.favoredName, 'Buffalo Bills')
  assert.equal(resAwayWin.modelSource, 'Final')
})

test('Live game with ESPN FPI: normalizes percentages accurately', () => {
  const homeComp = { id: '1', score: '14', team: { displayName: 'Eagles', abbreviation: 'PHI' } }
  const awayComp = { id: '2', score: '10', team: { displayName: 'Cowboys', abbreviation: 'DAL' } }

  const res = calculateWinProbability({
    homeWinPercentage: 0.712,
    awayWinPercentage: 0.288,
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'in',
  })
  assert.equal(res.homePct, 71.2)
  assert.equal(res.awayPct, 28.8)
  assert.equal(res.homePct + res.awayPct, 100)
  assert.equal(res.modelSource, 'ESPN FPI')
  assert.equal(res.isHomeFavored, true)
})

test('Pre-game with Vegas Moneyline: de-vigs American odds accurately', () => {
  const homeComp = { id: '1', score: '0', team: { displayName: 'San Francisco 49ers', abbreviation: 'SF' } }
  const awayComp = { id: '2', score: '0', team: { displayName: 'Arizona Cardinals', abbreviation: 'ARI' } }

  const res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'pre',
    odds: [
      {
        details: 'SF -7.5',
        spread: -7.5,
        moneyline: {
          home: { close: { odds: '-395' } },
          away: { close: { odds: '+310' } },
        },
      },
    ],
  })

  // -395 vs +310 should de-vig to ~76.6% SF
  assert.ok(res.homePct >= 75 && res.homePct <= 78)
  assert.equal(res.homePct + res.awayPct, 100)
  assert.equal(res.modelSource, 'Vegas Moneyline')
  assert.equal(res.favoredName, 'San Francisco 49ers')
})

test('Pre-game with Point Spread only: calculates accurate Gaussian probability', () => {
  const homeComp = { id: '1', score: '0', team: { displayName: 'Ravens', abbreviation: 'BAL' } }
  const awayComp = { id: '2', score: '0', team: { displayName: 'Bengals', abbreviation: 'CIN' } }

  const res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'pre',
    odds: [{ spread: -3.5 }],
  })

  // -3.5 spread in NFL corresponds to ~60% win probability
  assert.ok(res.homePct >= 58 && res.homePct <= 63)
  assert.equal(res.homePct + res.awayPct, 100)
  assert.equal(res.modelSource, 'Vegas Spread')
})

test('In-game analytic model: time decay properly increases lead confidence', () => {
  const homeComp = { id: '1', score: '21', team: { displayName: 'Detroit Lions', abbreviation: 'DET' } }
  const awayComp = { id: '2', score: '14', team: { displayName: 'Chicago Bears', abbreviation: 'CHI' } }

  // 7-point lead in Q1 (45 min left)
  const q1Res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'in',
    status: { period: 1, clock: 900 },
  })

  // 7-point lead with 1 minute left in Q4 (60s left)
  const q4Res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'in',
    status: { period: 4, clock: 60 },
  })

  // Same 7-point lead must be much more decisive near the end of the game
  assert.ok(q4Res.homePct > q1Res.homePct)
  assert.ok(q1Res.homePct >= 60 && q1Res.homePct <= 75)
  assert.ok(q4Res.homePct >= 90)
  assert.equal(q1Res.modelSource, 'Live Analytic Model')
})

test('Pre-game without Vegas odds: returns Pregame Projection with home-field baseline', () => {
  const homeComp = { id: '1', score: '0', team: { displayName: 'Miami Dolphins', abbreviation: 'MIA' } }
  const awayComp = { id: '2', score: '0', team: { displayName: 'New York Jets', abbreviation: 'NYJ' } }

  const res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'pre',
  })

  assert.equal(res.homePct, 53.5)
  assert.equal(res.awayPct, 46.5)
  assert.equal(res.isHomeFavored, true)
  assert.equal(res.modelSource, 'Pregame Projection')
})

test('In-game analytic model at Halftime: treats 2nd half as 1800s remaining and ignores previous drive field position', () => {
  const homeComp = { id: '5', score: '10', team: { displayName: 'Browns', abbreviation: 'CLE' } }
  const awayComp = { id: '29', score: '3', team: { displayName: 'Panthers', abbreviation: 'CAR' } }

  const halftimeStatus = {
    period: 2,
    clock: 0,
    displayClock: '0:00',
    type: { state: 'in', name: 'STATUS_HALFTIME', detail: 'Halftime' },
  }

  // Previous 2nd-quarter situation with CLE on own 17
  const situation = {
    down: 1,
    distance: 11,
    yardLine: 17,
    possession: '5',
    isRedZone: false,
  }

  const res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'in',
    status: halftimeStatus,
    situation,
  })

  // Browns lead 10-3 (+7) at Halftime. Expected win probability should be around ~70-78% for home team
  assert.ok(res.homePct >= 68 && res.homePct <= 80, `Expected ~70-78% but got ${res.homePct}`)
  assert.equal(res.homePct + res.awayPct, 100)
  assert.equal(res.isHomeFavored, true)
  assert.equal(res.modelSource, 'Live Analytic Model')
})

test('Boundary & Chaos Testing: calculateWinProbability never returns NaN or out-of-bounds percentages', () => {
  const homeComp = { id: '1', score: '-5', team: { displayName: 'Team A' } }
  const awayComp = { id: '2', score: 'NaN', team: { displayName: 'Team B' } }

  const res = calculateWinProbability({
    homeWinPercentage: -0.5,
    awayWinPercentage: 1.8,
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'in',
    status: null,
    situation: null,
    odds: [{ spread: Infinity }],
  })

  assert.ok(Number.isFinite(res.homePct))
  assert.ok(Number.isFinite(res.awayPct))
  assert.ok(res.homePct >= 0 && res.homePct <= 100)
  assert.ok(res.awayPct >= 0 && res.awayPct <= 100)
  assert.equal(Math.round((res.homePct + res.awayPct) * 10) / 10, 100)
})

test('getBettingOddsInfo correctly extracts and formats pre-game handicap and O/U points total', () => {
  // 1. Standard details string with spread & total (e.g. NYG -3 • O/U 44.5)
  const nygInfo = getBettingOddsInfo(
    [{ details: 'NYG -3', overUnder: 44.5 }],
    'NYG',
    'DAL'
  )
  assert.equal(nygInfo.handicap, 'NYG -3')
  assert.equal(nygInfo.overUnder, 'O/U 44.5')
  assert.equal(nygInfo.overUnderValue, 44.5)
  assert.equal(nygInfo.formattedSummary, 'NYG -3 • O/U 44.5')

  // 2. Patriots sanitization (NE -> FNE)
  const neInfo = getBettingOddsInfo(
    [{ details: 'NE -2.5', overUnder: 41.0 }],
    'FNE',
    'CHI'
  )
  assert.equal(neInfo.handicap, 'FNE -2.5')
  assert.equal(neInfo.overUnder, 'O/U 41')
  assert.equal(neInfo.formattedSummary, 'FNE -2.5 • O/U 41')

  // 3. Pick'em / Even spread
  const evenInfo = getBettingOddsInfo(
    [{ details: 'even', overUnder: 48 }],
    'KC',
    'BUF'
  )
  assert.equal(evenInfo.handicap, 'EVEN')
  assert.equal(evenInfo.overUnder, 'O/U 48')
  assert.equal(evenInfo.formattedSummary, 'EVEN • O/U 48')

  // 4. Spread number fallback when details string is missing (negative spread favors home)
  const spreadHomeFav = getBettingOddsInfo(
    [{ spread: -3.5, overUnder: 47.5 }],
    'CHI',
    'FNE'
  )
  assert.equal(spreadHomeFav.handicap, 'CHI -3.5')
  assert.equal(spreadHomeFav.overUnder, 'O/U 47.5')
  assert.equal(spreadHomeFav.formattedSummary, 'CHI -3.5 • O/U 47.5')

  // 5. Spread number fallback when away team is favored (positive spread)
  const spreadAwayFav = getBettingOddsInfo(
    [{ spread: 4.0, overUnder: 52 }],
    'CAR',
    'GB'
  )
  assert.equal(spreadAwayFav.handicap, 'GB -4')
  assert.equal(spreadAwayFav.overUnder, 'O/U 52')
  assert.equal(spreadAwayFav.formattedSummary, 'GB -4 • O/U 52')

  // 6. Graceful null safety on missing or malformed inputs
  const nullInfo = getBettingOddsInfo(null)
  assert.equal(nullInfo.handicap, null)
  assert.equal(nullInfo.overUnder, null)
  assert.equal(nullInfo.formattedSummary, null)

  const emptyInfo = getBettingOddsInfo([])
  assert.equal(emptyInfo.handicap, null)
  assert.equal(emptyInfo.formattedSummary, null)
})

test('calculateWinProbability populates handicap, overUnder, and formattedOdds', () => {
  const homeComp = { id: '1', score: '0', team: { displayName: 'Chicago Bears', abbreviation: 'CHI' } }
  const awayComp = { id: '2', score: '0', team: { displayName: 'New England Patriots', abbreviation: 'NE' } }

  const res = calculateWinProbability({
    homeCompetitor: homeComp,
    awayCompetitor: awayComp,
    gameState: 'pre',
    odds: [
      {
        details: 'CHI -2.5',
        overUnder: 43.5,
        spread: -2.5,
      },
    ],
  })

  assert.equal(res.handicap, 'CHI -2.5')
  assert.equal(res.overUnder, 43.5)
  assert.equal(res.overUnderText, 'O/U 43.5')
  assert.equal(res.formattedOdds, 'CHI -2.5 • O/U 43.5')
})

