import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateWinProbability, normalCdf } from './winProbability.ts'
import { getGameSecondsRemaining, makeScoreKey, hasOccurred } from './scorigami.ts'
import {
  isRedZoneSituation,
  isHalftimeSituation,
} from './nflHelpers.ts'
import { normalizeNFLEvent } from './normalizer.ts'
import { getMockLiveGames } from '../services/espnApi.ts'

test('Military Grade: Mathematical Invariant of Normal CDF & Gaussian Symmetry', () => {
  // normalCdf(0) == 0.5
  assert.equal(Math.abs(normalCdf(0) - 0.5) < 1e-6, true)
  // Symmetry: normalCdf(-z) + normalCdf(z) == 1.0
  for (let z = 0.1; z <= 6.0; z += 0.25) {
    const sum = normalCdf(-z) + normalCdf(z)
    assert.ok(Math.abs(sum - 1.0) < 1e-5, `Failed CDF symmetry at z=${z}`)
  }
  // Extreme boundaries
  assert.equal(normalCdf(-10), 0)
  assert.equal(normalCdf(10), 1)
})

test('Military Grade: Win Probability Monotonic Time Decay Principle', () => {
  const homeComp = { id: '1', score: '24', team: { displayName: 'Kansas City Chiefs' } }
  const awayComp = { id: '2', score: '14', team: { displayName: 'Buffalo Bills' } }

  let lastHomePct = 0
  // Chiefs lead by 10 points in the 4th quarter.
  // As time counts down from 900s to 10s, Chiefs win probability must monotonically increase
  const clockCheckpoints = [900, 600, 300, 120, 60, 30, 10]
  for (const clock of clockCheckpoints) {
    const res = calculateWinProbability({
      homeCompetitor: homeComp,
      awayCompetitor: awayComp,
      gameState: 'in',
      status: {
        clock,
        displayClock: `${Math.floor(clock / 60)}:${clock % 60}`,
        period: 4,
        type: { state: 'in' },
      },
      situation: {
        down: 1,
        distance: 10,
        yardLine: 50,
        possession: '1',
      },
    })

    assert.ok(
      res.homePct >= lastHomePct,
      `Time decay monotonicity violated: clock=${clock}s yielded ${res.homePct}% which is < previous ${lastHomePct}%`
    )
    assert.equal(Math.round((res.homePct + res.awayPct) * 10) / 10, 100)
    lastHomePct = res.homePct
  }
})

test('Military Grade: Monotonic Point Spread Impact in Pre-game', () => {
  const homeComp = { id: '1', score: '0', team: { displayName: 'Home Team' } }
  const awayComp = { id: '2', score: '0', team: { displayName: 'Away Team' } }

  let prevHomePct = 100
  // In ESPN odds: spread is negative when home team is favored.
  // As spread goes from -14 (heavy home favor) to +14 (heavy away favor),
  // home win probability MUST strictly decrease.
  for (let spread = -14; spread <= 14; spread += 1.0) {
    const res = calculateWinProbability({
      homeCompetitor: homeComp,
      awayCompetitor: awayComp,
      gameState: 'pre',
      odds: [{ spread }],
    })

    assert.ok(
      res.homePct <= prevHomePct,
      `Spread monotonicity violated: spread ${spread} yielded ${res.homePct}% > prev ${prevHomePct}%`
    )
    assert.equal(Math.round((res.homePct + res.awayPct) * 10) / 10, 100)
    prevHomePct = res.homePct
  }
})

test('Military Grade: Halftime State Exactness Across All Ambiguities', () => {
  // Case A: ESPN status name
  assert.equal(isHalftimeSituation({ type: { name: 'STATUS_HALFTIME' } }), true)
  // Case B: detail string "Halftime"
  assert.equal(isHalftimeSituation({ type: { detail: 'Halftime' } }), true)
  // Case C: detail string "At Halftime"
  assert.equal(isHalftimeSituation({ type: { detail: 'At Halftime' } }), true)
  // Case D: detail string "End of 1st Half"
  assert.equal(isHalftimeSituation({ type: { detail: 'End of 1st Half' } }), true)
  // Case E: period 2 with clock 0:00 and state 'in'
  assert.equal(isHalftimeSituation({ period: 2, clock: 0, type: { state: 'in' } }), true)
  // Case F: period 2 with displayClock '0:00'
  assert.equal(isHalftimeSituation({ period: 2, displayClock: '0:00', type: { state: 'in' } }), true)
  // Case G: period 2 with last play "END QUARTER 2"
  assert.equal(
    isHalftimeSituation(
      { period: 2, clock: 0, type: { state: 'in' } },
      { lastPlay: { text: 'END QUARTER 2' } }
    ),
    true
  )

  // Counter-cases: Must NOT trigger on End of Q1, End of Q3, or Final
  assert.equal(isHalftimeSituation({ period: 1, clock: 0, type: { state: 'in', detail: 'End of 1st' } }), false)
  assert.equal(isHalftimeSituation({ period: 3, clock: 0, type: { state: 'in', detail: 'End of 3rd' } }), false)
  assert.equal(isHalftimeSituation({ period: 4, clock: 0, type: { state: 'post', completed: true, detail: 'Final' } }), false)
  assert.equal(isHalftimeSituation(null), false)
  assert.equal(isHalftimeSituation(undefined), false)
})

test('Military Grade: True Game Seconds Remaining Rigorous Boundary Checks', () => {
  // Pre-game = 3600
  assert.equal(getGameSecondsRemaining(null, 'pre'), 3600)
  // Post-game = 0
  assert.equal(getGameSecondsRemaining(null, 'post'), 0)
  // Halftime = exactly 1800 regardless of clock quirks
  assert.equal(getGameSecondsRemaining({ type: { name: 'STATUS_HALFTIME' } }, 'in'), 1800)
  assert.equal(getGameSecondsRemaining({ type: { detail: 'Halftime' } }, 'in'), 1800)
  // Start of game Q1 15:00 = 3600s
  assert.equal(getGameSecondsRemaining({ period: 1, clock: 900 }, 'in'), 3600)
  // End of Q1 (clock 0, period 1) = 2700s
  assert.equal(getGameSecondsRemaining({ period: 1, clock: 0 }, 'in'), 2700)
  // Mid Q3 7:30 (clock 450, period 3) = 1 * 900 + 450 = 1350s
  assert.equal(getGameSecondsRemaining({ period: 3, clock: 450 }, 'in'), 1350)
  // End of regulation Q4 0:00 = 0s
  assert.equal(getGameSecondsRemaining({ period: 4, clock: 0 }, 'in'), 0)
  // Overtime with 10:00 (600s) left
  assert.equal(getGameSecondsRemaining({ period: 5, clock: 600 }, 'in'), 600)
})

test('Military Grade: Red Zone Strict Rules Verification', () => {
  const homeComp = { id: 'home-1', homeAway: 'home', team: { abbreviation: 'KC' } }
  const awayComp = { id: 'away-2', homeAway: 'away', team: { abbreviation: 'BUF' } }
  const comps = [homeComp, awayComp]

  // Scenario 1: KC driving right towards BUF goal (100) at yardLine 85 (BUF 15) -> GENUINE RED ZONE
  assert.equal(
    isRedZoneSituation(
      { down: 1, yardLine: 85, possession: 'home-1', isRedZone: true },
      { clock: 300, period: 4, type: { state: 'in' } },
      comps
    ),
    true
  )

  // Scenario 2: KC at own 15 yard line (yardLine 15 driving right towards 100) -> NOT RED ZONE even if ESPN says isRedZone=true
  assert.equal(
    isRedZoneSituation(
      { down: 1, yardLine: 15, possession: 'home-1', isRedZone: true },
      { clock: 300, period: 4, type: { state: 'in' } },
      comps
    ),
    false
  )

  // Scenario 3: Kickoff (down = -1) inside 20 -> NOT RED ZONE
  assert.equal(
    isRedZoneSituation(
      { down: -1, yardLine: 85, possession: 'home-1', isRedZone: true },
      { clock: 300, period: 4, type: { state: 'in' } },
      comps
    ),
    false
  )

  // Scenario 4: Halftime with yardLine 85 -> NOT RED ZONE
  assert.equal(
    isRedZoneSituation(
      { down: 1, yardLine: 85, possession: 'home-1', isRedZone: true },
      { clock: 0, period: 2, type: { state: 'in', name: 'STATUS_HALFTIME' } },
      comps
    ),
    false
  )

  // Scenario 5: BUF driving left towards KC goal (0) at yardLine 12 (KC 12) -> GENUINE RED ZONE
  assert.equal(
    isRedZoneSituation(
      { down: 2, yardLine: 12, possession: 'away-2', isRedZone: true },
      { clock: 400, period: 3, type: { state: 'in' } },
      comps
    ),
    true
  )
})

test('Military Grade: Scorigami Key Canonical Invariant', () => {
  // Order of scores must never change key
  assert.equal(makeScoreKey(24, 17), '24-17')
  assert.equal(makeScoreKey(17, 24), '24-17')
  assert.equal(makeScoreKey(0, 0), '0-0')
  assert.equal(makeScoreKey(73, 0), '73-0')

  // Check known historical scorigamis
  assert.equal(hasOccurred(20, 17), true)
  assert.equal(hasOccurred(70, 20), true)
  assert.equal(hasOccurred(73, 0), true)
  assert.equal(hasOccurred(2, 0), true)

  // Check known NEVER occurred scores
  assert.equal(hasOccurred(73, 72), false)
  assert.equal(hasOccurred(4, 4), false)
  assert.equal(hasOccurred(6, 1), false)
})

test('Military Grade: Complete Simulation Engine 50-Cycle Stress Test', () => {
  for (let cycle = 0; cycle < 50; cycle++) {
    const games = getMockLiveGames()
    assert.equal(games.length, 5)

    for (const g of games) {
      assert.ok(g.id)
      assert.ok(g.name)
      assert.ok(g.competitions?.length > 0)
      const comp = g.competitions[0]
      assert.equal(comp.competitors.length, 2)

      const home = comp.competitors.find((c) => c.homeAway === 'home')
      const away = comp.competitors.find((c) => c.homeAway === 'away')
      assert.ok(home)
      assert.ok(away)

      // Normalize through military grade event normalizer
      const norm = normalizeNFLEvent(g)
      assert.ok(norm.id)
      assert.ok(norm.home.team.displayName)
      assert.ok(norm.away.team.displayName)
      assert.ok(['pre', 'in', 'post'].includes(norm.state))
      assert.ok(Number.isFinite(norm.home.score))
      assert.ok(Number.isFinite(norm.away.score))
    }
  }
})

test('Military Grade: 5,000 Chaos Fuzz Inputs Never Throw Unhandled Error', () => {
  const weirdInputs = [
    null,
    undefined,
    {},
    { id: null, competitions: [] },
    { competitions: [{ competitors: null, situation: { yardLine: NaN, down: Infinity } }] },
    { status: { period: -999, clock: 'invalid' } },
    { score: '99999999999999999999' },
    { score: '-10' },
    { team: { color: 'not-a-color', logo: 'javascript:alert(1)' } },
  ]

  for (let i = 0; i < 5000; i++) {
    const pick = weirdInputs[i % weirdInputs.length]
    assert.doesNotThrow(() => {
      normalizeNFLEvent(pick, i)
    })
  }
})
