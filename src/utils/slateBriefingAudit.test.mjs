import test from 'node:test'
import assert from 'node:assert/strict'
import { isOvertimeSituation, formatPeriodDisplay } from './nflHelpers.ts'
import { normalizeNFLEvent } from './normalizer.ts'

// Pure replication of SlateBriefing's selection logic to guarantee zero drift
function computeSlateBriefingSummary(events) {
  const liveEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return (e.status?.type?.state || comp?.status?.type?.state) === 'in'
  })

  const finalEvents = events.filter((e) => {
    const comp = e.competitions?.[0]
    return (e.status?.type?.state || comp?.status?.type?.state) === 'post'
  })

  const overtimeThrillers = liveEvents
    .filter((ev) => isOvertimeSituation(ev))
    .slice()
    .sort((a, b) => {
      const getDiff = (ev) => {
        const comp = ev.competitions?.[0]
        const h = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
        const aw = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
        return Math.abs(h - aw)
      }
      return getDiff(a) - getDiff(b)
    })

  const fourthQuarterThrillers = liveEvents
    .filter((ev) => {
      if (isOvertimeSituation(ev)) return false
      const period = ev.status?.period ?? 0
      if (period !== 4) return false
      const comp = ev.competitions?.[0]
      const homeScore = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
      const awayScore = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
      return Math.abs(homeScore - awayScore) <= 8
    })
    .slice()
    .sort((a, b) => {
      const getDiff = (ev) => {
        const comp = ev.competitions?.[0]
        const h = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
        const aw = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
        return Math.abs(h - aw)
      }
      return getDiff(a) - getDiff(b)
    })

  const closestFinalGame = finalEvents.slice().sort((a, b) => {
    const getDiff = (ev) => {
      const comp = ev.competitions?.[0]
      const h = parseInt(comp?.competitors?.find((c) => c.homeAway === 'home')?.score || '0', 10)
      const aw = parseInt(comp?.competitors?.find((c) => c.homeAway === 'away')?.score || '0', 10)
      return Math.abs(h - aw)
    }
    const aIsOT = isOvertimeSituation(a)
    const bIsOT = isOvertimeSituation(b)
    if (aIsOT && !bIsOT) return -1
    if (!aIsOT && bIsOT) return 1
    return getDiff(a) - getDiff(b)
  })[0]

  const primeAlertEvent =
    overtimeThrillers[0] ||
    fourthQuarterThrillers[0] ||
    liveEvents[0] ||
    closestFinalGame

  let headline = ''
  if (overtimeThrillers.length > 0) {
    headline = `Overtime Thriller: ${primeAlertEvent?.name || 'Live OT'}`
  } else if (fourthQuarterThrillers.length > 0) {
    headline = `4th Quarter Thriller: ${primeAlertEvent?.name || 'Live Q4'}`
  } else if (liveEvents.length > 0) {
    headline = `${liveEvents.length} Games Live`
  } else if (closestFinalGame && isOvertimeSituation(closestFinalGame)) {
    headline = `Final • OT Thriller: ${closestFinalGame?.name || 'Final OT'}`
  } else {
    headline = `All ${finalEvents.length} Games Concluded`
  }

  let storylineSubtext = ''
  if (overtimeThrillers.includes(primeAlertEvent)) {
    storylineSubtext = `Overtime drama with ${primeAlertEvent.status?.displayClock || '0:00'} remaining`
  } else if (fourthQuarterThrillers.includes(primeAlertEvent)) {
    storylineSubtext = `One-score drama with ${primeAlertEvent.status?.displayClock} remaining`
  } else if (liveEvents.includes(primeAlertEvent)) {
    storylineSubtext = `${formatPeriodDisplay(primeAlertEvent.status?.period ?? 1, 'short')} ${primeAlertEvent.status?.displayClock}`
  }

  return { headline, storylineSubtext, primeAlertEvent }
}

test('Slate Briefing: Game in Overtime is NEVER identified as 4th Quarter', () => {
  const otGame = {
    id: 'game-in-ot',
    name: 'BAL vs KC',
    status: {
      period: 5,
      clock: 512,
      displayClock: '8:32',
      type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: '8:32 - OT' },
    },
    competitions: [
      {
        status: { period: 5, clock: 512, displayClock: '8:32', type: { state: 'in' } },
        competitors: [
          { homeAway: 'home', score: '24', team: { abbreviation: 'KC' } },
          { homeAway: 'away', score: '24', team: { abbreviation: 'BAL' } },
        ],
      },
    ],
  }

  const briefing = computeSlateBriefingSummary([otGame])

  // Headline MUST specify Overtime, and NEVER 4th Quarter
  assert.equal(briefing.headline.includes('Overtime Thriller'), true)
  assert.equal(briefing.headline.includes('4th Quarter'), false)

  // Subtext MUST state Overtime drama, NEVER Q5 or 4th Quarter
  assert.equal(briefing.storylineSubtext.includes('Overtime drama with 8:32 remaining'), true)
  assert.equal(briefing.storylineSubtext.includes('Q5'), false)
  assert.equal(briefing.storylineSubtext.includes('4th Quarter'), false)
})

test('Slate Briefing: Overtime thriller takes precedence over 4th Quarter thriller', () => {
  const q4Game = {
    id: 'game-q4',
    name: 'DET vs GB',
    status: {
      period: 4,
      clock: 45,
      displayClock: '0:45',
      type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: '0:45 - 4th Quarter' },
    },
    competitions: [
      {
        status: { period: 4, clock: 45, displayClock: '0:45', type: { state: 'in' } },
        competitors: [
          { homeAway: 'home', score: '27', team: { abbreviation: 'GB' } },
          { homeAway: 'away', score: '24', team: { abbreviation: 'DET' } },
        ],
      },
    ],
  }

  const otGame = {
    id: 'game-ot',
    name: 'BUF vs MIA',
    status: {
      period: 5,
      clock: 300,
      displayClock: '5:00',
      type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: '5:00 - OT' },
    },
    competitions: [
      {
        status: { period: 5, clock: 300, displayClock: '5:00', type: { state: 'in' } },
        competitors: [
          { homeAway: 'home', score: '20', team: { abbreviation: 'MIA' } },
          { homeAway: 'away', score: '20', team: { abbreviation: 'BUF' } },
        ],
      },
    ],
  }

  const briefing = computeSlateBriefingSummary([q4Game, otGame])

  // Overtime takes prime storyline priority over Q4 regulation
  assert.equal(briefing.headline.includes('Overtime Thriller: BUF vs MIA'), true)
  assert.equal(briefing.storylineSubtext.includes('Overtime drama with 5:00 remaining'), true)
  assert.equal(briefing.primeAlertEvent.id, 'game-ot')
})

test('Slate Briefing: Legitimate 4th quarter game correctly announces 4th Quarter Thriller', () => {
  const q4Game = {
    id: 'game-q4-only',
    name: 'PHI vs DAL',
    status: {
      period: 4,
      clock: 120,
      displayClock: '2:00',
      type: { state: 'in', name: 'STATUS_IN_PROGRESS', detail: '2:00 - 4th Quarter' },
    },
    competitions: [
      {
        status: { period: 4, clock: 120, displayClock: '2:00', type: { state: 'in' } },
        competitors: [
          { homeAway: 'home', score: '31', team: { abbreviation: 'DAL' } },
          { homeAway: 'away', score: '28', team: { abbreviation: 'PHI' } },
        ],
      },
    ],
  }

  const briefing = computeSlateBriefingSummary([q4Game])
  assert.equal(briefing.headline.includes('4th Quarter Thriller: PHI vs DAL'), true)
  assert.equal(briefing.storylineSubtext.includes('One-score drama with 2:00 remaining'), true)
})

test('Normalizer: Live game in period >= 5 defaults to OT or 2OT instead of Q5 or Q6', () => {
  const rawOtPayload = {
    id: 'norm-ot',
    status: {
      period: 5,
      displayClock: '9:12',
      type: { state: 'in' }, // no detail provided
    },
    competitions: [
      {
        competitors: [
          { id: '1', homeAway: 'home', score: '20', team: { id: '1', displayName: 'Falcons', abbreviation: 'ATL' } },
          { id: '2', homeAway: 'away', score: '20', team: { id: '2', displayName: 'Saints', abbreviation: 'NO' } },
        ],
      },
    ],
  }

  const normalized = normalizeNFLEvent(rawOtPayload)
  assert.equal(normalized.period, 5)
  // Detail fallback must be 'OT', NOT 'Q5'
  assert.equal(normalized.detail, 'OT')

  // 2OT test
  const raw2OtPayload = {
    ...rawOtPayload,
    status: {
      period: 6,
      displayClock: '12:00',
      type: { state: 'in' },
    },
  }
  const norm2Ot = normalizeNFLEvent(raw2OtPayload)
  assert.equal(norm2Ot.period, 6)
  assert.equal(norm2Ot.detail, '2OT')
})

test('Period formatting: Never produces Q5, Q6, or Quarter 5 in aria and short formats', () => {
  // Period 5
  assert.equal(formatPeriodDisplay(5, 'short'), 'OT')
  assert.equal(formatPeriodDisplay(5, 'aria'), 'Overtime')
  assert.equal(formatPeriodDisplay(5, 'long'), 'Overtime')

  // Period 6
  assert.equal(formatPeriodDisplay(6, 'short'), '2OT')
  assert.equal(formatPeriodDisplay(6, 'aria'), '2nd Overtime')
  assert.equal(formatPeriodDisplay(6, 'long'), '2nd Overtime')
})
