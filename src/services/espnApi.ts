import type { NFLScoreboardData, NFLEvent } from '../types/nfl'

const ESPN_PRIMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
const ESPN_PROXY_URL = '/api/espn/apis/site/v2/sports/football/nfl/scoreboard'
const FETCH_TIMEOUT_MS = 8000

export async function fetchNFLScoreboard(externalSignal?: AbortSignal): Promise<NFLScoreboardData> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  // Link external signal if provided — keep a reference so we can remove it later
  let externalAbortHandler: (() => void) | null = null
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      throw new DOMException('Aborted', 'AbortError')
    }
    externalAbortHandler = () => controller.abort()
    externalSignal.addEventListener('abort', externalAbortHandler)
  }

  const cleanup = () => {
    clearTimeout(timeoutId)
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener('abort', externalAbortHandler)
    }
  }

  // Cache buster parameter to ensure fresh responses on each 10s poll
  const cacheBuster = `_t=${Date.now()}`
  const primaryUrl = `${ESPN_PRIMARY_URL}?${cacheBuster}`
  const proxyUrl = `${ESPN_PROXY_URL}?${cacheBuster}`

  // 1. Direct fetch to ESPN API
  try {
    const res = await fetch(primaryUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && Array.isArray(data.events)) {
        cleanup()
        return data as NFLScoreboardData
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && externalSignal?.aborted) {
      cleanup()
      throw err // Cancelled by caller — propagate immediately
    }
    // Network or CORS issue — fall through to proxy
  }

  // 2. Fallback to local Vite dev proxy
  try {
    const proxyRes = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    if (proxyRes.ok) {
      const data = await proxyRes.json()
      if (data && Array.isArray(data.events)) {
        cleanup()
        return data as NFLScoreboardData
      }
    }
  } catch (proxyErr: any) {
    if (proxyErr?.name === 'AbortError' && externalSignal?.aborted) {
      cleanup()
      throw proxyErr
    }
  }

  cleanup()
  throw new Error('Unable to connect to ESPN NFL Scoreboard. Check network connection or try again.')
}

/**
 * Stateful dynamic simulation sequence for Demo Mode.
 * Seamlessly advances downs, yardages, win probabilities, and clock on each 10-second poll.
 *
 * NOTE: We use an object reference rather than a bare `let` so that React Strict
 * Mode double-invocations in development do NOT cause scenarios to double-advance.
 * The counter only increments when getMockLiveGames() is called with intent=true.
 */
const _sim = { step: 0 }

const SIMULATION_SCENARIOS = [
  {
    clock: '1:44',
    clockSeconds: 104,
    period: 4,
    down: 3,
    distance: 4,
    yardLine: 18,
    isRedZone: true,
    downDistanceText: '3rd & 4 at BUF 18',
    possessionText: 'BUF 18',
    lastPlayText: 'P.Mahomes pass short middle to T.Kelce for 8 yards to the BUF 18.',
    homeWinPct: 0.584,
    awayWinPct: 0.416,
    homeScore: '27',
    awayScore: '24',
  },
  {
    clock: '1:18',
    clockSeconds: 78,
    period: 4,
    down: 1,
    distance: 8,
    yardLine: 8,
    isRedZone: true,
    downDistanceText: '1st & Goal at BUF 8',
    possessionText: 'BUF 8',
    lastPlayText: 'P.Mahomes scrambles right for 10 yards to the BUF 8. FIRST DOWN & GOAL!',
    homeWinPct: 0.442,
    awayWinPct: 0.558,
    homeScore: '27',
    awayScore: '24',
  },
  {
    clock: '0:52',
    clockSeconds: 52,
    period: 4,
    down: 2,
    distance: 3,
    yardLine: 3,
    isRedZone: true,
    downDistanceText: '2nd & Goal at BUF 3',
    possessionText: 'BUF 3',
    lastPlayText: 'I.Pacheco rush up the middle for 5 yards to the BUF 3.',
    homeWinPct: 0.381,
    awayWinPct: 0.619,
    homeScore: '27',
    awayScore: '24',
  },
  {
    clock: '0:44',
    clockSeconds: 44,
    period: 4,
    down: -1,
    distance: 0,
    yardLine: 0,
    isRedZone: true,
    downDistanceText: 'PAT Good • Chiefs Lead',
    possessionText: 'BUF Endzone',
    lastPlayText: 'TOUCHDOWN KANSAS CITY! P.Mahomes 3 yard pass to X.Worthy. (PAT Good).',
    homeWinPct: 0.285,
    awayWinPct: 0.715,
    homeScore: '27',
    awayScore: '31',
  },
  {
    clock: '0:35',
    clockSeconds: 35,
    period: 4,
    down: 1,
    distance: 10,
    yardLine: 32, // BUF possession driving toward KC (0 to 100)
    isRedZone: false,
    downDistanceText: '1st & 10 at BUF 32',
    possessionText: 'BUF 32',
    lastPlayText: 'J.Allen pass deep sideline to K.Shakir for 22 yards out of bounds.',
    homeWinPct: 0.364,
    awayWinPct: 0.636,
    homeScore: '27',
    awayScore: '31',
  },
]

export function getMockLiveGames(): NFLEvent[] {
  const currentScenario = SIMULATION_SCENARIOS[_sim.step % SIMULATION_SCENARIOS.length]
  _sim.step++

  return [
    {
      id: 'mock-1',
      uid: 's:20~l:28~e:mock1',
      date: new Date().toISOString(),
      name: 'Kansas City Chiefs at Buffalo Bills',
      shortName: 'KC @ BUF',
      competitions: [
        {
          id: 'mock-1-comp',
          uid: 's:20~l:28~e:mock1~c:1',
          date: new Date().toISOString(),
          status: {
            clock: currentScenario.clockSeconds,
            displayClock: currentScenario.clock,
            period: currentScenario.period,
            type: {
              id: '2',
              name: 'STATUS_IN_PROGRESS',
              state: 'in',
              completed: false,
              description: 'In Progress',
              detail: `${currentScenario.clock} - 4th Quarter`,
              shortDetail: `${currentScenario.clock} - 4th`,
            },
          },
          competitors: [
            {
              id: '2',
              homeAway: 'home',
              score: currentScenario.homeScore,
              records: [{ summary: '11-3' }],
              team: {
                id: '2',
                name: 'Bills',
                displayName: 'Buffalo Bills',
                abbreviation: 'BUF',
                color: '00338d',
                alternateColor: 'd50a0a',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/buf.png',
              },
            },
            {
              id: '12',
              homeAway: 'away',
              score: currentScenario.awayScore,
              records: [{ summary: '12-2' }],
              team: {
                id: '12',
                name: 'Chiefs',
                displayName: 'Kansas City Chiefs',
                abbreviation: 'KC',
                color: 'e31837',
                alternateColor: 'ffb81c',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/kc.png',
              },
            },
          ],
          situation: {
            down: currentScenario.down,
            yardLine: currentScenario.yardLine,
            distance: currentScenario.distance,
            downDistanceText: currentScenario.downDistanceText,
            shortDownDistanceText: currentScenario.downDistanceText,
            possessionText: currentScenario.possessionText,
            possession: currentScenario.down === 1 && currentScenario.yardLine === 32 ? '2' : '12',
            isRedZone: currentScenario.isRedZone,
            homeTimeouts: 2,
            awayTimeouts: 1,
            lastPlay: {
              id: `play-mock-${_sim.step}`,
              text: currentScenario.lastPlayText,
              statYardage: 8,
              probability: {
                homeWinPercentage: currentScenario.homeWinPct,
                awayWinPercentage: currentScenario.awayWinPct,
              },
            },
          },
          broadcasts: [{ market: 'National', names: ['CBS'] }],
          venue: {
            fullName: 'Highmark Stadium',
            address: { city: 'Orchard Park', state: 'NY' },
          },
        },
      ],
      status: {
        clock: currentScenario.clockSeconds,
        displayClock: currentScenario.clock,
        period: currentScenario.period,
        type: {
          id: '2',
          name: 'STATUS_IN_PROGRESS',
          state: 'in',
          completed: false,
          description: 'In Progress',
          detail: `${currentScenario.clock} - 4th Quarter`,
          shortDetail: `${currentScenario.clock} - 4th`,
        },
      },
    },
    {
      id: 'mock-2',
      uid: 's:20~l:28~e:mock2',
      date: new Date().toISOString(),
      name: 'Detroit Lions at Green Bay Packers',
      shortName: 'DET @ GB',
      competitions: [
        {
          id: 'mock-2-comp',
          uid: 's:20~l:28~e:mock2~c:1',
          date: new Date().toISOString(),
          status: {
            clock: 380,
            displayClock: '6:20',
            period: 3,
            type: {
              id: '2',
              name: 'STATUS_IN_PROGRESS',
              state: 'in',
              completed: false,
              description: 'In Progress',
              detail: '6:20 - 3rd Quarter',
              shortDetail: '6:20 - 3rd',
            },
          },
          competitors: [
            {
              id: '9',
              homeAway: 'home',
              score: '17',
              records: [{ summary: '9-5' }],
              team: {
                id: '9',
                name: 'Packers',
                displayName: 'Green Bay Packers',
                abbreviation: 'GB',
                color: '203731',
                alternateColor: 'ffb612',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/gb.png',
              },
            },
            {
              id: '8',
              homeAway: 'away',
              score: '21',
              records: [{ summary: '11-3' }],
              team: {
                id: '8',
                name: 'Lions',
                displayName: 'Detroit Lions',
                abbreviation: 'DET',
                color: '0076b6',
                alternateColor: 'b0b7bc',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/det.png',
              },
            },
          ],
          situation: {
            down: 1,
            yardLine: 65,
            distance: 10,
            downDistanceText: '1st & 10 at DET 35',
            shortDownDistanceText: '1st & 10',
            possessionText: 'DET 35',
            possession: '9',
            isRedZone: false,
            homeTimeouts: 3,
            awayTimeouts: 3,
            lastPlay: {
              id: 'play-mock-2',
              text: 'J.Love deep left to C.Watson for 29 yards to the DET 35 (B.Branch).',
              statYardage: 29,
              probability: {
                homeWinPercentage: 0.442,
                awayWinPercentage: 0.558,
              },
            },
          },
          broadcasts: [{ market: 'National', names: ['FOX'] }],
          venue: {
            fullName: 'Lambeau Field',
            address: { city: 'Green Bay', state: 'WI' },
          },
        },
      ],
      status: {
        clock: 380,
        displayClock: '6:20',
        period: 3,
        type: {
          id: '2',
          name: 'STATUS_IN_PROGRESS',
          state: 'in',
          completed: false,
          description: 'In Progress',
          detail: '6:20 - 3rd Quarter',
          shortDetail: '6:20 - 3rd',
        },
      },
    },
    {
      id: 'mock-3',
      uid: 's:20~l:28~e:mock3',
      date: new Date().toISOString(),
      name: 'San Francisco 49ers at Philadelphia Eagles',
      shortName: 'SF @ PHI',
      competitions: [
        {
          id: 'mock-3-comp',
          uid: 's:20~l:28~e:mock3~c:1',
          date: new Date().toISOString(),
          status: {
            clock: 0,
            displayClock: '0:00',
            period: 4,
            type: {
              id: '3',
              name: 'STATUS_FINAL',
              state: 'post',
              completed: true,
              description: 'Final',
              detail: 'Final',
              shortDetail: 'Final',
            },
          },
          competitors: [
            {
              id: '21',
              homeAway: 'home',
              winner: true,
              score: '28',
              records: [{ summary: '12-2' }],
              team: {
                id: '21',
                name: 'Eagles',
                displayName: 'Philadelphia Eagles',
                abbreviation: 'PHI',
                color: '004c54',
                alternateColor: 'a5acaf',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/phi.png',
              },
            },
            {
              id: '25',
              homeAway: 'away',
              winner: false,
              score: '24',
              records: [{ summary: '10-4' }],
              team: {
                id: '25',
                name: '49ers',
                displayName: 'San Francisco 49ers',
                abbreviation: 'SF',
                color: 'aa0000',
                alternateColor: 'b3995d',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sf.png',
              },
            },
          ],
          situation: null,
          broadcasts: [{ market: 'National', names: ['NBC'] }],
          venue: {
            fullName: 'Lincoln Financial Field',
            address: { city: 'Philadelphia', state: 'PA' },
          },
        },
      ],
      status: {
        clock: 0,
        displayClock: '0:00',
        period: 4,
        type: {
          id: '3',
          name: 'STATUS_FINAL',
          state: 'post',
          completed: true,
          description: 'Final',
          detail: 'Final',
          shortDetail: 'Final',
        },
      },
    },
    {
      id: 'mock-4',
      uid: 's:20~l:28~e:mock4',
      date: new Date(Date.now() + 86400000).toISOString(),
      name: 'Baltimore Ravens at Cincinnati Bengals',
      shortName: 'BAL @ CIN',
      competitions: [
        {
          id: 'mock-4-comp',
          uid: 's:20~l:28~e:mock4~c:1',
          date: new Date(Date.now() + 86400000).toISOString(),
          status: {
            clock: 900,
            displayClock: '15:00',
            period: 1,
            type: {
              id: '1',
              name: 'STATUS_SCHEDULED',
              state: 'pre',
              completed: false,
              description: 'Scheduled',
              detail: 'Sunday Night Football - 8:20 PM ET',
              shortDetail: 'Sun, 8:20 PM',
            },
          },
          competitors: [
            {
              id: '4',
              homeAway: 'home',
              score: '0',
              records: [{ summary: '10-5' }],
              team: {
                id: '4',
                name: 'Bengals',
                displayName: 'Cincinnati Bengals',
                abbreviation: 'CIN',
                color: 'fb4f14',
                alternateColor: '000000',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/cin.png',
              },
            },
            {
              id: '33',
              homeAway: 'away',
              score: '0',
              records: [{ summary: '11-4' }],
              team: {
                id: '33',
                name: 'Ravens',
                displayName: 'Baltimore Ravens',
                abbreviation: 'BAL',
                color: '241773',
                alternateColor: '9e7c0c',
                logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/bal.png',
              },
            },
          ],
          situation: null,
          broadcasts: [{ market: 'National', names: ['NBC'] }],
          venue: {
            fullName: 'Paycor Stadium',
            address: { city: 'Cincinnati', state: 'OH' },
          },
          odds: [
            {
              provider: { id: 'draftkings', name: 'DraftKings', displayName: 'DraftKings' },
              details: 'CIN -2.5',
              overUnder: 48.5,
              spread: -2.5,
              moneyline: {
                home: { close: { odds: '-135' } },
                away: { close: { odds: '+115' } },
              },
            },
          ],
        },
      ],
      status: {
        clock: 900,
        displayClock: '15:00',
        period: 1,
        type: {
          id: '1',
          name: 'STATUS_SCHEDULED',
          state: 'pre',
          completed: false,
          description: 'Scheduled',
          detail: 'Sunday Night Football - 8:20 PM ET',
          shortDetail: 'Sun, 8:20 PM',
        },
      },
    },
  ]
}
