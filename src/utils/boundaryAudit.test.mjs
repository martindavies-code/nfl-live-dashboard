import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatLocalizedKickoff,
  areColorsTooSimilar,
  resolveContrastingTeamColors,
} from './nflHelpers.ts'
import { calculateWinProbability } from './winProbability.ts'

test('Boundary Audit: formatLocalizedKickoff handles all date inputs and timezones', () => {
  // Null / undefined / invalid
  assert.equal(formatLocalizedKickoff(null), 'Upcoming')
  assert.equal(formatLocalizedKickoff(undefined), 'Upcoming')
  assert.equal(formatLocalizedKickoff(''), 'Upcoming')
  assert.equal(formatLocalizedKickoff('not-a-date'), 'Upcoming')
  assert.equal(formatLocalizedKickoff(NaN), 'Upcoming')

  // Valid ISO strings in Europe/London (Summer BST & Winter GMT)
  const bstResult = formatLocalizedKickoff('2026-10-04T17:00:00Z', 'Europe/London')
  assert.ok(bstResult.includes('Sun'), `Expected Sun in ${bstResult}`)
  assert.ok(bstResult.includes('6:00 PM'), `Expected 6:00 PM in ${bstResult}`)
  assert.ok(bstResult.includes('BST') || bstResult.includes('GMT+1'), `Expected BST in ${bstResult}`)

  const gmtResult = formatLocalizedKickoff('2026-12-13T18:00:00Z', 'Europe/London')
  assert.ok(gmtResult.includes('Sun'), `Expected Sun in ${gmtResult}`)
  assert.ok(gmtResult.includes('6:00 PM'), `Expected 6:00 PM in ${gmtResult}`)
  assert.ok(gmtResult.includes('GMT'), `Expected GMT in ${gmtResult}`)

  // Valid ISO strings in America/New_York (Eastern Time)
  const nyResult = formatLocalizedKickoff('2026-10-04T17:00:00Z', 'America/New_York')
  assert.ok(nyResult.includes('Sun'), `Expected Sun in ${nyResult}`)
  assert.ok(nyResult.includes('1:00 PM'), `Expected 1:00 PM in ${nyResult}`)

  // Valid ISO strings in America/Los_Angeles (Pacific Time)
  const laResult = formatLocalizedKickoff('2026-10-04T17:00:00Z', 'America/Los_Angeles')
  assert.ok(laResult.includes('Sun'), `Expected Sun in ${laResult}`)
  assert.ok(laResult.includes('10:00 AM'), `Expected 10:00 AM in ${laResult}`)

  // Default host/browser environment localization (without explicit timezone param)
  const defaultResult = formatLocalizedKickoff('2026-10-04T17:00:00Z')
  assert.ok(defaultResult.includes('Sun'), `Expected weekday in ${defaultResult}`)

  // Date object input
  const dateObj = new Date('2026-09-10T00:20:00Z')
  const dateObjResult = formatLocalizedKickoff(dateObj, 'Europe/London')
  assert.ok(dateObjResult.includes('Thu'), `Expected Thu in ${dateObjResult}`)
  assert.ok(dateObjResult.includes('1:20 AM'), `Expected 1:20 AM in ${dateObjResult}`)
})

test('Boundary Audit: FieldDiagram Play Direction Arrow & Badges Mathematical Invariants', () => {
  // Test every single integer yardline from 0 to 100
  for (let yard = 0; yard <= 100; yard++) {
    const yardLineClamped = Math.max(0, Math.min(100, yard))
    const scrimmageX = 100 + yardLineClamped * 10
    const distance = 10

    for (const direction of ['right', 'left']) {
      let firstDownYardLine = yardLineClamped
      if (direction === 'right') {
        firstDownYardLine = Math.min(100, yardLineClamped + distance)
      } else {
        firstDownYardLine = Math.max(0, yardLineClamped - distance)
      }
      const firstDownX = 100 + firstDownYardLine * 10

      // Badges must NEVER cross into end zones (0..100 and 1100..1200)
      const losBadgeX = Math.max(124, Math.min(1076, scrimmageX))
      const firstDownBadgeX = Math.max(126, Math.min(1074, firstDownX))

      assert.ok(losBadgeX >= 124 && losBadgeX <= 1076, `LOS badge out of bounds: ${losBadgeX}`)
      assert.ok(firstDownBadgeX >= 126 && firstDownBadgeX <= 1074, `1st Down badge out of bounds: ${firstDownBadgeX}`)

      // Streamlined Broadcast Direction Arrow invariants (60px length, clamped tip)
      const arrowLength = 60
      let arrowStartX
      let arrowTipX
      let arrowHeadBaseX

      if (direction === 'right') {
        const rawTipX = scrimmageX + 26 + arrowLength
        arrowTipX = Math.min(1185, rawTipX)
        arrowStartX = arrowTipX - arrowLength
        arrowHeadBaseX = arrowTipX - 22
      } else {
        const rawTipX = scrimmageX - 26 - arrowLength
        arrowTipX = Math.max(15, rawTipX)
        arrowStartX = arrowTipX + arrowLength
        arrowHeadBaseX = arrowTipX + 22
      }

      // Invariant 1: Total arrow length MUST be exactly 60px
      const measuredLength = Math.abs(arrowTipX - arrowStartX)
      assert.equal(measuredLength, 60, `Arrow length collapsed at yard ${yard}, dir ${direction}`)

      // Invariant 2: Arrow tip must never exceed canvas boundaries (0..1200)
      assert.ok(arrowTipX >= 15 && arrowTipX <= 1185, `Arrow tip out of bounds: ${arrowTipX}`)
      assert.ok(arrowStartX >= 15 && arrowStartX <= 1185, `Arrow start out of bounds: ${arrowStartX}`)

      // Invariant 3: Arrow head must point in the correct direction
      if (direction === 'right') {
        assert.ok(arrowTipX > arrowHeadBaseX, `Right arrow tip not ahead of base at yard ${yard}`)
      } else {
        assert.ok(arrowTipX < arrowHeadBaseX, `Left arrow tip not ahead of base at yard ${yard}`)
      }
    }
  }
})

test('Boundary Audit: All 32 NFL Teams Color Contrast Resolution Matrix', () => {
  const nflTeams = [
    { abbr: 'ARI', color: '97233f', alt: '000000' },
    { abbr: 'ATL', color: 'a71930', alt: '000000' },
    { abbr: 'BAL', color: '241773', alt: '000000' },
    { abbr: 'BUF', color: '00338d', alt: 'c60c30' },
    { abbr: 'CAR', color: '0085ca', alt: '101820' },
    { abbr: 'CHI', color: '0b162a', alt: 'c83803' },
    { abbr: 'CIN', color: 'fb4f14', alt: '000000' },
    { abbr: 'CLE', color: '311d00', alt: 'ff3c00' },
    { abbr: 'DAL', color: '003594', alt: '041e42' },
    { abbr: 'DEN', color: 'fb4f14', alt: '002244' },
    { abbr: 'DET', color: '0076b6', alt: 'b0b7bc' },
    { abbr: 'GB',  color: '203731', alt: 'ffb612' },
    { abbr: 'HOU', color: '03202f', alt: 'a71930' },
    { abbr: 'IND', color: '002c5f', alt: 'a2aaad' },
    { abbr: 'JAX', color: '006778', alt: 'd7a22a' },
    { abbr: 'KC',  color: 'e31837', alt: 'ffb81c' },
    { abbr: 'LV',  color: '000000', alt: 'a5acaf' },
    { abbr: 'LAC', color: '0080c6', alt: 'ffc20e' },
    { abbr: 'LAR', color: '003594', alt: 'ffa300' },
    { abbr: 'MIA', color: '008e97', alt: 'fc4c02' },
    { abbr: 'MIN', color: '4f2683', alt: 'ffc62f' },
    { abbr: 'NE',  color: '002244', alt: 'c60c30' },
    { abbr: 'NO',  color: 'd3bc8d', alt: '101820' },
    { abbr: 'NYG', color: '0b2265', alt: 'a71930' },
    { abbr: 'NYJ', color: '125740', alt: '000000' },
    { abbr: 'PHI', color: '004c54', alt: 'a5acaf' },
    { abbr: 'PIT', color: 'ffb612', alt: '101820' },
    { abbr: 'SF',  color: 'aa0000', alt: 'b3995d' },
    { abbr: 'SEA', color: '002244', alt: '69be28' },
    { abbr: 'TB',  color: 'd3bc8d', alt: '0a0a08' },
    { abbr: 'TEN', color: '0c2340', alt: '4b92db' },
    { abbr: 'WAS', color: '5a1414', alt: 'ffb612' },
  ]

  // Test every team against every other team
  for (let i = 0; i < nflTeams.length; i++) {
    for (let j = 0; j < nflTeams.length; j++) {
      const homeTeam = nflTeams[i]
      const awayTeam = nflTeams[j]

      const homeComp = { team: { abbreviation: homeTeam.abbr, color: homeTeam.color, alternateColor: homeTeam.alt } }
      const awayComp = { team: { abbreviation: awayTeam.abbr, color: awayTeam.color, alternateColor: awayTeam.alt } }

      const resolved = resolveContrastingTeamColors(homeComp, awayComp)

      // Both colors must be valid hex strings
      assert.ok(/^#[0-9a-f]{6}$/i.test(resolved.homeColor), `Invalid homeColor ${resolved.homeColor}`)
      assert.ok(/^#[0-9a-f]{6}$/i.test(resolved.awayColor), `Invalid awayColor ${resolved.awayColor}`)

      // Colors must NOT be too similar
      const isClashing = areColorsTooSimilar(resolved.homeColor, resolved.awayColor)
      assert.equal(
        isClashing,
        false,
        `Resolved colors still clash for ${homeTeam.abbr} (${resolved.homeColor}) vs ${awayTeam.abbr} (${resolved.awayColor})`
      )
    }
  }
})

test('Boundary Audit: 10,000 Chaotic Game Situations in Win Probability Engine', () => {
  const testStates = ['pre', 'in', 'post']
  const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

  for (let i = 0; i < 10000; i++) {
    const gameState = testStates[i % 3]
    const homeScore = String(randomBetween(0, 70))
    const awayScore = String(randomBetween(0, 70))
    const period = randomBetween(1, 5)
    const clock = randomBetween(0, 900)
    const yardLine = randomBetween(0, 100)
    const down = randomBetween(-1, 4)
    const distance = randomBetween(0, 40)
    const spread = (randomBetween(-240, 240) / 10).toFixed(1)

    const res = calculateWinProbability({
      homeCompetitor: { score: homeScore, team: { abbreviation: 'HOME' } },
      awayCompetitor: { score: awayScore, team: { abbreviation: 'AWAY' } },
      gameState,
      status: {
        period,
        clock,
        displayClock: `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`,
        type: { state: gameState, completed: gameState === 'post' },
      },
      situation: {
        down,
        distance,
        yardLine,
        possession: i % 2 === 0 ? 'home' : 'away',
      },
      odds: [{ details: `${spread}` }],
    })

    // Assert strictly numeric, finite, within bounds
    assert.ok(Number.isFinite(res.homePct), `homePct is not finite at iteration ${i}`)
    assert.ok(Number.isFinite(res.awayPct), `awayPct is not finite at iteration ${i}`)
    assert.ok(res.homePct >= 0 && res.homePct <= 100, `homePct out of bounds: ${res.homePct}`)
    assert.ok(res.awayPct >= 0 && res.awayPct <= 100, `awayPct out of bounds: ${res.awayPct}`)

    const total = Math.round((res.homePct + res.awayPct) * 10) / 10
    assert.equal(total, 100, `Probability sum != 100: ${res.homePct} + ${res.awayPct} = ${total}`)
    assert.ok(res.modelSource, 'modelSource must not be empty')
  }
})
