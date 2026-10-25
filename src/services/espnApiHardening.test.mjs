import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REAL_NFL_DATA_SOURCES,
  fetchNFLScoreboard,
  fetchEventDrivePlays,
  getMockLiveGames,
  _resetCacheWriteTimeForTesting,
} from './espnApi.ts'

test('REAL_NFL_DATA_SOURCES parseResponse handles all branches and edge cases', () => {
  for (const src of REAL_NFL_DATA_SOURCES) {
    assert.equal(src.parseResponse(null), null)
    assert.equal(src.parseResponse(undefined), null)
    assert.equal(src.parseResponse({}), null)
    assert.equal(src.parseResponse('invalid json'), null)
    assert.equal(src.parseResponse({ events: 'not an array' }), null)

    // Direct events
    const directValid = src.parseResponse({ events: [{ id: 'ev-1', name: 'Test' }] })
    assert.ok(directValid)
    assert.equal(directValid.events[0].id, 'ev-1')

    // Wrapped content.sbData
    const wrappedValid = src.parseResponse({
      content: {
        sbData: {
          events: [{ id: 'ev-2', name: 'Wrapped' }],
        },
      },
    })
    if (src.id.includes('web-api') || src.id === 'local-dev-proxy') {
      // web-api and local-dev-proxy only expect direct events
      assert.equal(wrappedValid, null)
    } else {
      assert.ok(wrappedValid)
      assert.equal(wrappedValid.events[0].id, 'ev-2')
    }

    if (src.enabledForEnv) {
      assert.equal(src.enabledForEnv(true), true)
      assert.equal(src.enabledForEnv(false), false)
    }
  }
})

test('fetchNFLScoreboard succeeds with live data from primary source and writes cache', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window

  const writtenKeys = new Set()
  try {
    globalThis.window = {
      location: { hostname: 'localhost' },
      localStorage: {
        getItem: () => null,
        setItem: (k) => writtenKeys.add(k),
      },
    }

    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          events: [{ id: 'test-1', name: 'Test Team A vs Test Team B' }],
        }),
      }
    }

    const controller = new AbortController()
    const result = await fetchNFLScoreboard({ seasonType: 2, week: 4, year: 2026 }, controller.signal)
    assert.ok(result)
    assert.equal(result.isCached, false)
    assert.equal(result.data.events.length, 1)
    assert.equal(result.data.events[0].id, 'test-1')
    assert.ok(writtenKeys.has('nfl_real_cache_latest'))

    // Test localStorage error resilience (e.g. QuotaExceededError in private browsing)
    _resetCacheWriteTimeForTesting()
    globalThis.window.localStorage.setItem = () => {
      throw new Error('QuotaExceeded')
    }
    const result2 = await fetchNFLScoreboard({ seasonType: 2, week: 4, year: 2026 })
    assert.ok(result2)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('fetchNFLScoreboard handles AbortSignal and aborts cleanly', async () => {
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    () => fetchNFLScoreboard(controller.signal),
    (err) => err.name === 'AbortError'
  )

  // Abort during loop
  const originalFetch = globalThis.fetch
  try {
    const liveController = new AbortController()
    globalThis.fetch = async () => {
      liveController.abort()
      throw new Error('Aborted network')
    }
    await assert.rejects(
      () => fetchNFLScoreboard(undefined, liveController.signal),
      (err) => err.name === 'AbortError'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchNFLScoreboard parameters clamping and fallbacks', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''

  try {
    globalThis.fetch = async (url) => {
      requestedUrl = String(url)
      return {
        ok: true,
        json: async () => ({
          events: [{ id: 'test-clamp', name: 'Clamped Param Event' }],
        }),
      }
    }

    await fetchNFLScoreboard({ seasonType: 99, week: 999, year: 3500 })
    assert.ok(requestedUrl.includes('seasontype=4'))
    assert.ok(requestedUrl.includes('week=25'))
    assert.ok(requestedUrl.includes('dates=2100'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchNFLScoreboard falls back to localStorage cache when all remote mirrors fail', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window

  const mockStorage = new Map()
  mockStorage.set(
    'nfl_real_cache_2_4',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      sourceId: 'mock-mirror',
      sourceName: 'Mock Mirror CDN',
      data: {
        events: [{ id: 'cached-ev', name: 'Cached Game' }],
      },
    })
  )

  try {
    globalThis.window = {
      location: { hostname: 'localhost' },
      localStorage: {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, v),
      },
    }

    globalThis.fetch = async () => {
      throw new Error('Network timeout simulated')
    }

    const res = await fetchNFLScoreboard({ seasonType: 2, week: 4 })
    assert.ok(res.isCached)
    assert.equal(res.sourceId, 'offline-cache')
    assert.equal(res.data.events[0].id, 'cached-ev')

    // Corrupt JSON in cache test
    mockStorage.set('nfl_real_cache_2_4', '{ corrupt json')
    await assert.rejects(
      () => fetchNFLScoreboard({ seasonType: 2, week: 4 }),
      /Unable to connect to live NFL scoreboard across all/
    )
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('fetchNFLScoreboard throws descriptive error if all sources and cache fail', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window

  try {
    globalThis.window = undefined
    globalThis.fetch = async () => {
      throw new Error('Connection refused')
    }

    await assert.rejects(
      () => fetchNFLScoreboard({ seasonType: 2, week: 5 }),
      /Unable to connect to live NFL scoreboard across all/
    )
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('fetchEventDrivePlays handles empty eventId and network errors in local and prod', async () => {
  assert.deepEqual(await fetchEventDrivePlays(''), [])

  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  try {
    globalThis.window = {
      location: { hostname: 'localhost' },
    }
    globalThis.fetch = async () => {
      throw new Error('Fetch failed mirror')
    }
    const plays = await fetchEventDrivePlays('invalid-event')
    assert.deepEqual(plays, [])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('fetchEventDrivePlays parses current drives and falls back to previous drives safely', async () => {
  const originalFetch = globalThis.fetch
  try {
    // 1. Current drive with plays
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        drives: {
          current: {
            plays: [
              {
                id: 'play-1',
                text: 'P.Mahomes pass short right to T.Kelce for 8 yards',
                statYardage: 8,
                type: { text: 'Pass Reception' },
                start: { yardLine: 35, down: 1, distance: 10 },
                end: { yardLine: 43 },
              },
            ],
          },
        },
      }),
    })

    const plays1 = await fetchEventDrivePlays('event-1')
    assert.equal(plays1.length, 1)
    assert.equal(plays1[0].id, 'play-1')

    // 2. No current drive, fall back to previous
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        drives: {
          previous: [
            {
              plays: [
                {
                  id: 'prev-play-1',
                  text: 'J.Allen rush for 4 yards',
                  statYardage: 4,
                  type: { text: 'Rush' },
                  start: { yardLine: 20, down: 1, distance: 10 },
                  end: { yardLine: 24 },
                },
              ],
            },
          ],
        },
      }),
    })

    const plays2 = await fetchEventDrivePlays('event-2')
    assert.equal(plays2.length, 1)
    assert.equal(plays2[0].id, 'prev-play-1')

    // 3. Current drive exists but has empty plays (protects against flipping)
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        drives: {
          current: { plays: [] },
          previous: [
            {
              plays: [
                {
                  id: 'stale-play',
                  text: 'Stale play from older drive',
                },
              ],
            },
          ],
        },
      }),
    })

    const plays3 = await fetchEventDrivePlays('event-3')
    assert.deepEqual(plays3, [])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getMockLiveGames covers all playoff rounds and season types', () => {
  // Super Bowl (Season Type 3, Week 5)
  const sb = getMockLiveGames(3, 5)
  assert.equal(sb.length, 1)
  assert.equal(sb[0].id, 'mock-sb-1')
  assert.ok(sb[0].name.includes('Super Bowl'))

  // Conference Championship (Season Type 3, Week 3)
  const champ = getMockLiveGames(3, 3)
  assert.equal(champ.length, 2)
  assert.ok(champ[0].name.includes('AFC Championship'))

  // Past Regular Season Week 1 (Season Type 2, Week 1)
  const w1 = getMockLiveGames(2, 1)
  assert.equal(w1.length, 2)
  assert.equal(w1[0].status.type.state, 'post')

  // Default active simulation mode (Regular season)
  const def = getMockLiveGames(2, 4)
  assert.equal(def.length, 5)
})

test('NFLApiError and NFLNetworkError hierarchy and properties', async () => {
  const { NFLApiError, NFLNetworkError, NFLValidationError } = await import('./espnApi.ts')

  const baseErr = new NFLApiError('Base error')
  assert.ok(baseErr instanceof Error)
  assert.equal(baseErr.name, 'NFLApiError')
  assert.equal(baseErr.message, 'Base error')

  const netErr = new NFLNetworkError('All mirrors down', ['Fastly CDN', 'Akamai Cloud'])
  assert.ok(netErr instanceof Error)
  assert.ok(netErr instanceof NFLApiError)
  assert.equal(netErr.name, 'NFLNetworkError')
  assert.deepEqual(netErr.sourcesAttempted, ['Fastly CDN', 'Akamai Cloud'])

  const valErr = new NFLValidationError('Invalid schema')
  assert.ok(valErr instanceof Error)
  assert.ok(valErr instanceof NFLApiError)
  assert.equal(valErr.name, 'NFLValidationError')
})

test('fetchEventDrivePlays handles immediate AbortSignal and in-flight mirror failures', async () => {
  const controller = new AbortController()
  controller.abort()

  // Immediately aborted signal returns empty array without fetching
  const resAborted = await fetchEventDrivePlays('event-abort-test', controller.signal)
  assert.deepEqual(resAborted, [])

  // In-flight fetch throws error, failover handles gracefully
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      throw new Error('Network timeout')
    }
    const resFail = await fetchEventDrivePlays('event-fail-test')
    assert.deepEqual(resFail, [])

    // In-flight externalSignal abort
    const inflightController = new AbortController()
    globalThis.fetch = async () => {
      inflightController.abort()
      throw new DOMException('Aborted', 'AbortError')
    }
    const resInflightAbort = await fetchEventDrivePlays('event-inflight-abort', inflightController.signal)
    assert.deepEqual(resInflightAbort, [])

    // Timeout trigger abort
    globalThis.fetch = (_url, opts) =>
      new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    const resTimeout = await fetchEventDrivePlays('event-timeout-test', undefined, 5)
    assert.deepEqual(resTimeout, [])
  } finally {
    globalThis.fetch = originalFetch
  }
})


