import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  parseArticle,
  parseCrew,
  crewsAgree,
  loadManualSources,
  resolveTargetWeeks,
  reconcileWeek,
  discoverArticles,
  canonicalNetwork,
} from './update-announcers.mjs'

const YAHOO_WEEK12_FIXTURE = `
<!doctype html>
<html>
<head><title>TV broadcast maps and announcers for Week 12 of the 2026 season - Yahoo Sports</title></head>
<body>
  <p>Wednesday (8:00 p.m. ET): <strong>Green Bay Packers</strong> vs. <strong>Los Angeles Rams</strong> (Netflix - Noah Eagle, Luke Kuechly, Tom Pelissero, MJ Acosta-Ruiz)</p>
  <p>Thursday (1:00 p.m. ET): <strong>Chicago Bears</strong> vs. <strong>Detroit Lions</strong> (CBS - Jim Nantz, J.J. Watt, Tracy Wolfson)</p>
  <p>Thursday (4:30 p.m. ET): <strong>Philadelphia Eagles</strong> vs. <strong>Dallas Cowboys</strong> (FOX - Kevin Burkhardt, Tom Brady, Erin Andrews, Tom Rinaldi)</p>
  <p>Thursday (8:20 p.m. ET): <strong>Kansas City Chiefs</strong> vs. <strong>Buffalo Bills</strong> (NBC - Mike Tirico, Cris Collinsworth, Melissa Stark)</p>
  <p>Friday (8:15 p.m. ET): <strong>Indianapolis Colts</strong> vs. <strong>Houston Texans</strong> (Amazon Prime - Al Michaels, Kirk Herbstreit, Kaylee Hartung)</p>
  <p>Saturday (4:30 p.m. ET): <strong>New England Patriots</strong> vs. <strong>Los Angeles Chargers</strong> (Peacock - Andrew Catalon, Logan Ryan, AJ Ross)</p>
  <p>Saturday (8:15 p.m. ET): <strong>Seattle Seahawks</strong> vs. <strong>San Francisco 49ers</strong> (YouTube - Kevin Kugler, Daryl Johnston, Allison Williams)</p>
  <p>Red: <strong>New Orleans Saints</strong> vs. <strong>Cincinnati Bengals</strong> (Ian Eagle, Ross Tucker, Evan Washburn)</p>
  <p>Blue: <strong>Baltimore Ravens</strong> vs. <strong>Houston Texans</strong> (Kevin Harlan, Trent Green, Melanie Collins)</p>
  <p>Green (Late): <strong>Las Vegas Raiders</strong> vs. <strong>Cleveland Browns</strong> (NBC - Mike Tirico, Jason Garrett, Melissa Stark)</p>
</body>
</html>
`

const AA_WEEK12_FIXTURE = `
<!doctype html>
<html>
<head><title>Your 2026 NFL Week 12 announcing schedule</title></head>
<body>
  <p>Here is a look at the television networks and announcers for the Week 12 NFL games (all times are Eastern):</p>
  <p>Green Bay Packers at Los Angeles Rams (8 p.m., Netflix): Noah Eagle (play-by-play), Luke Kuechly (analyst), Tom Pelissero (reporter), MJ Acosta-Ruiz (reporter)</p>
  <p>Chicago Bears at Detroit Lions (1 p.m., CBS): Jim Nantz (play-by-play), J.J. Watt (analyst), Tracy Wolfson (reporter)</p>
  <p>Philadelphia Eagles at Dallas Cowboys (4:30 p.m., Fox): Kevin Burkhardt (play-by-play), Tom Brady (analyst), Erin Andrews (reporter), Tom Rinaldi (reporter)</p>
  <p>Kansas City Chiefs at Buffalo Bills (8:20 p.m., NBC): Mike Tirico (play-by-play), Cris Collinsworth (analyst), Melissa Stark (reporter)</p>
  <p>Denver Broncos at Pittsburgh Steelers (3 p.m., Prime Video): Al Michaels (play-by-play), Kirk Herbstreit (analyst), Kaylee Hartung (reporter)</p>
  <p>New England Patriots at Los Angeles Chargers (4:05 p.m., Peacock): Andrew Catalon (play-by-play), Logan Ryan (analyst), AJ Ross (reporter)</p>
  <p>Seattle Seahawks at San Francisco 49ers (8:15 p.m., YouTube): Kevin Kugler (play-by-play), Daryl Johnston (analyst), Allison Williams (reporter)</p>
  <p>Carolina Panthers at Tampa Bay Buccaneers (8:15 p.m., ESPN): Joe Buck (play-by-play), Troy Aikman (analyst), Lisa Salters (reporter), Laura Rutledge (reporter); Field Pass with The Pat McAfee Show on ESPN2</p>
</body>
</html>
`

test('Parser: Yahoo Week 12 inline fixture with bold team names, Wednesday/Friday/Saturday and Netflix/Prime/Peacock/YouTube', () => {
  const res = parseArticle(YAHOO_WEEK12_FIXTURE, 'https://sports.yahoo.com/nfl/articles/tv-broadcast-maps-announcers-week-151543372.html')
  assert.equal(res.sourceDomain, 'yahoo.com')

  const wed = res.pairings.get('GB|LAR')
  assert.ok(wed?.crew, 'Wednesday Netflix GB@LAR must parse')
  assert.equal(wed.network, 'Netflix')
  assert.equal(wed.crew.playByPlay, 'Noah Eagle')
  assert.deepEqual(wed.crew.analysts, ['Luke Kuechly'])
  assert.deepEqual(wed.crew.sideline, ['Tom Pelissero', 'MJ Acosta-Ruiz'])

  const thu1 = res.pairings.get('CHI|DET')
  assert.equal(thu1?.network, 'CBS')
  assert.equal(thu1?.crew?.playByPlay, 'Jim Nantz')
  assert.deepEqual(thu1?.crew?.analysts, ['J.J. Watt'])

  const satPeacock = res.pairings.get('LAC|NE')
  assert.equal(satPeacock?.network, 'Peacock')
  assert.equal(satPeacock?.crew?.playByPlay, 'Andrew Catalon')

  const satYoutube = res.pairings.get('SEA|SF')
  assert.equal(satYoutube?.network, 'YouTube')
  assert.equal(satYoutube?.crew?.playByPlay, 'Kevin Kugler')

  const regional = res.pairings.get('CIN|NO')
  assert.equal(regional?.crew?.playByPlay, 'Ian Eagle')
  assert.deepEqual(regional?.crew?.sideline, ['Evan Washburn'])
})

test('Parser: Awful Announcing schedule fixture with role tags, streaming networks, and ESPN2 Field Pass suffix', () => {
  const res = parseArticle(AA_WEEK12_FIXTURE, 'https://awfulannouncing.com/nfl/week-12-schedule-2026-tv.html')
  assert.equal(res.sourceDomain, 'awfulannouncing.com')

  const wed = res.pairings.get('GB|LAR')
  assert.ok(wed?.crew)
  assert.equal(wed.network, 'Netflix')
  assert.equal(wed.crew.hasRoleTags, true)
  assert.equal(wed.crew.playByPlay, 'Noah Eagle')
  assert.deepEqual(wed.crew.analysts, ['Luke Kuechly'])
  assert.deepEqual(wed.crew.sideline, ['Tom Pelissero', 'MJ Acosta-Ruiz'])

  const fri = res.pairings.get('DEN|PIT')
  assert.equal(fri?.network, 'Amazon Prime Video')
  assert.equal(fri?.crew?.playByPlay, 'Al Michaels')

  const mnf = res.pairings.get('CAR|TB')
  assert.equal(mnf?.network, 'ESPN')
  assert.equal(mnf?.crew?.playByPlay, 'Joe Buck')
  assert.deepEqual(mnf?.crew?.analysts, ['Troy Aikman'])
  assert.deepEqual(mnf?.crew?.sideline, ['Lisa Salters', 'Laura Rutledge'])
})

test('Reconciliation: requires two agreeing independent sources or explicit confirmation, and rejects conflicts', () => {
  const yahoo = parseArticle(YAHOO_WEEK12_FIXTURE, 'https://sports.yahoo.com/nfl/articles/week-12.html')
  const aa = parseArticle(AA_WEEK12_FIXTURE, 'https://awfulannouncing.com/nfl/week-12.html')

  // Conflict article: puts wrong crew on CHI@DET
  const conflictHtml = `<p>Chicago Bears at Detroit Lions (1 p.m., CBS): Ian Eagle (play-by-play), Ross Tucker (analyst), Evan Washburn (reporter)</p>`
  const conflictArt = parseArticle(conflictHtml, 'https://www.beaconjournal.com/story/sports/nfl/week-12')

  const games = [
    { season: 2026, week: 12, away: 'GB', home: 'LAR', network: 'Netflix', kickoffUtc: '2026-11-26T01:00:00Z', key: 'GB|LAR' },
    { season: 2026, week: 12, away: 'DEN', home: 'PIT', network: 'Amazon Prime Video', kickoffUtc: '2026-11-27T20:00:00Z', key: 'DEN|PIT' },
    { season: 2026, week: 12, away: 'CHI', home: 'DET', network: 'CBS', kickoffUtc: '2026-11-26T18:00:00Z', key: 'CHI|DET' },
  ]

  // Without confirmSingleSource: GB@LAR (2 agreeing sources) is written, DEN@PIT (1 source) is NOT, CHI@DET (conflict) is NOT
  const res = reconcileWeek(games, [yahoo, aa, conflictArt], {
    today: '2026-11-25',
    checkRegistry: () => undefined,
  })
  assert.equal(res.newEntries.length, 1)
  assert.equal(res.newEntries[0].away, 'GB')
  assert.equal(res.newEntries[0].sources.length, 2)
  assert.equal(res.conflicts.length, 1)
  assert.equal(res.conflicts[0].game.away, 'CHI')

  const denReason = res.unmatched.find((u) => u.game.away === 'DEN')
  assert.equal(denReason?.reason, 'single source only')

  // With confirmSingleSource=true: DEN@PIT (1 source) IS written, CHI@DET (conflict) STILL is NOT written
  const confirmedRes = reconcileWeek(games, [yahoo, aa, conflictArt], {
    today: '2026-11-25',
    confirmSingleSource: true,
    checkRegistry: () => undefined,
  })
  assert.equal(confirmedRes.newEntries.length, 2)
  assert.ok(confirmedRes.newEntries.some((e) => e.away === 'DEN' && e.home === 'PIT'))
  assert.ok(!confirmedRes.newEntries.some((e) => e.away === 'CHI'))
})

test('Diagnostics: logs every unmatched ESPN game reason (no pairing found, TBA crew, team name not parsed, ambiguous, kickoff outside window)', () => {
  const html = `
    <p>Wednesday (8:00 p.m. ET): Green Bay Packers vs. Los Angeles Rams (Netflix - TBA)</p>
    <p>Thursday (1:00 p.m. ET): New York vs. Dallas Cowboys (FOX - Kevin Burkhardt, Tom Brady)</p>
    <p>Sunday (1:00 p.m. ET): Cleveland Browns vs. Unknown City (CBS - Spero Dedes, Adam Archuleta)</p>
  `
  const art = parseArticle(html, 'https://awfulannouncing.com/nfl/test.html')
  const games = [
    { season: 2026, week: 12, away: 'GB', home: 'LAR', network: 'Netflix', kickoffUtc: '2026-11-26T01:00:00Z', key: 'GB|LAR' },
    { season: 2026, week: 12, away: 'NYG', home: 'DAL', network: 'FOX', kickoffUtc: '2026-11-26T21:30:00Z', key: 'DAL|NYG' },
    { season: 2026, week: 12, away: 'CLE', home: 'CIN', network: 'CBS', kickoffUtc: '2026-11-29T18:00:00Z', key: 'CIN|CLE' },
    { season: 2026, week: 12, away: 'ATL', home: 'MIN', network: 'FOX', kickoffUtc: '2026-11-29T18:00:00Z', key: 'ATL|MIN' },
    { season: 2026, week: 12, away: 'CAR', home: 'TB', network: 'ESPN', kickoffUtc: '2026-12-08T01:15:00Z', key: 'CAR|TB' },
  ]

  const res = reconcileWeek(games, [art], {
    today: '2026-11-25',
    confirmSingleSource: true,
    windowStart: '2026-11-25T08:00Z',
    windowEnd: '2026-12-02T07:59Z',
    checkRegistry: () => undefined,
  })
  assert.equal(res.newEntries.length, 0)
  const byMatchup = Object.fromEntries(res.unmatched.map((u) => [u.game.key, u.reason]))
  assert.equal(byMatchup['GB|LAR'], 'TBA crew')
  assert.equal(byMatchup['DAL|NYG'], 'ambiguous')
  assert.equal(byMatchup['CIN|CLE'], 'team name not parsed')
  assert.equal(byMatchup['ATL|MIN'], 'no pairing found')
  assert.equal(byMatchup['CAR|TB'], 'kickoff outside the week window')
})

test('Week window: ESPN 10-day calendar catches Thanksgiving Week 12 and Christmas Week 16 (Wed/Thu/Fri/Sat) before week flip', () => {
  const calendar = [
    {
      value: '2',
      entries: [
        { value: '11', startDate: '2026-11-18T08:00Z', endDate: '2026-11-25T07:59Z' },
        { value: '12', startDate: '2026-11-25T08:00Z', endDate: '2026-12-02T07:59Z' },
        { value: '13', startDate: '2026-12-02T08:00Z', endDate: '2026-12-09T07:59Z' },
        { value: '15', startDate: '2026-12-16T08:00Z', endDate: '2026-12-23T07:59Z' },
        { value: '16', startDate: '2026-12-23T08:00Z', endDate: '2026-12-30T07:59Z' },
        { value: '17', startDate: '2026-12-30T08:00Z', endDate: '2027-01-06T07:59Z' },
      ],
    },
  ]

  // Thanksgiving: Monday 23 Nov when ESPN week.number is still 11 — must include Week 12 (Wed Nov 25 / Thu Nov 26 / Fri Nov 27)
  const thanksgiving = resolveTargetWeeks(
    { season: { year: 2026, type: 2 }, week: { number: 11 }, leagues: [{ calendar }] },
    { weeks: 1, nowMs: Date.parse('2026-11-23T15:00:00Z') }
  )
  assert.deepEqual(thanksgiving.map((t) => t.week), [11, 12, 13])

  // Christmas: Tuesday 22 Dec when ESPN week.number is still 15 — must include Week 16 (Thu Dec 24, Christmas Day Fri Dec 25, Sat Dec 26)
  const christmas = resolveTargetWeeks(
    { season: { year: 2026, type: 2 }, week: { number: 15 }, leagues: [{ calendar }] },
    { weeks: 1, nowMs: Date.parse('2026-12-22T15:00:00Z') }
  )
  assert.deepEqual(christmas.map((t) => t.week), [15, 16, 17])

  // Verify Christmas-week schedule games (Thu Dec 24, Christmas Day Fri Dec 25, Sat Dec 26) match inside Week 16 window
  const christmasGames = [
    { season: 2026, week: 16, away: 'HOU', home: 'PHI', network: 'Amazon Prime Video', kickoffUtc: '2026-12-25T01:15:00Z', key: 'HOU|PHI' },
    { season: 2026, week: 16, away: 'GB', home: 'CHI', network: 'Netflix', kickoffUtc: '2026-12-25T18:00:00Z', key: 'CHI|GB' },
    { season: 2026, week: 16, away: 'BUF', home: 'DEN', network: 'Netflix', kickoffUtc: '2026-12-25T21:30:00Z', key: 'BUF|DEN' },
    { season: 2026, week: 16, away: 'LAR', home: 'SEA', network: 'FOX', kickoffUtc: '2026-12-26T01:15:00Z', key: 'LAR|SEA' },
    { season: 2026, week: 16, away: 'TB', home: 'ATL', network: 'NFL Network', kickoffUtc: '2026-12-27T01:00:00Z', key: 'ATL|TB' },
  ]
  const xmasYahoo = parseArticle(
    `
    <p>Thursday (8:15 p.m. ET): <strong>Houston Texans</strong> vs. <strong>Philadelphia Eagles</strong> (Amazon Prime - Al Michaels, Kirk Herbstreit, Kaylee Hartung)</p>
    <p>Friday (1:00 p.m. ET): <strong>Green Bay Packers</strong> vs. <strong>Chicago Bears</strong> (Netflix - Noah Eagle, Luke Kuechly, Tom Pelissero)</p>
    <p>Friday (4:30 p.m. ET): <strong>Buffalo Bills</strong> vs. <strong>Denver Broncos</strong> (Netflix - Ian Eagle, Ross Tucker, Evan Washburn)</p>
    <p>Friday (8:15 p.m. ET): <strong>Los Angeles Rams</strong> vs. <strong>Seattle Seahawks</strong> (FOX - Kevin Burkhardt, Tom Brady, Erin Andrews)</p>
    <p>Saturday (8:00 p.m. ET): <strong>Tampa Bay Buccaneers</strong> vs. <strong>Atlanta Falcons</strong> (NFL Network - Rich Eisen, Kurt Warner, Stacey Dales)</p>
    `,
    'https://sports.yahoo.com/nfl/articles/week-16-christmas.html'
  )
  const xmasAa = parseArticle(
    `
    <p>Houston Texans at Philadelphia Eagles (8:15 p.m., Prime Video): Al Michaels (play-by-play), Kirk Herbstreit (analyst), Kaylee Hartung (reporter)</p>
    <p>Green Bay Packers at Chicago Bears (1 p.m., Netflix): Noah Eagle (play-by-play), Luke Kuechly (analyst), Tom Pelissero (reporter)</p>
    <p>Buffalo Bills at Denver Broncos (4:30 p.m., Netflix): Ian Eagle (play-by-play), Ross Tucker (analyst), Evan Washburn (reporter)</p>
    <p>Los Angeles Rams at Seattle Seahawks (8:15 p.m., Fox): Kevin Burkhardt (play-by-play), Tom Brady (analyst), Erin Andrews (reporter)</p>
    <p>Tampa Bay Buccaneers at Atlanta Falcons (8 p.m., NFL Network): Rich Eisen (play-by-play), Kurt Warner (analyst), Stacey Dales (reporter)</p>
    `,
    'https://awfulannouncing.com/nfl/week-16-christmas.html'
  )
  const xmasRec = reconcileWeek(christmasGames, [xmasYahoo, xmasAa], {
    today: '2026-12-22',
    windowStart: '2026-12-23T08:00Z',
    windowEnd: '2026-12-30T07:59Z',
    checkRegistry: () => undefined,
  })
  assert.equal(xmasRec.newEntries.length, 5)
  assert.equal(xmasRec.unmatched.length, 0)
})

test('Discovery: prioritizes --url, scripts/announcer-sources.json, Bing RSS, then secondary search routes', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'announcer-src-'))
  const tmpFile = path.join(tmpDir, 'sources.json')
  try {
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        urls: ['https://sports.yahoo.com/nfl/articles/global-week-12.html'],
        byWeek: {
          '12': [{ url: 'https://awfulannouncing.com/nfl/manual-week-12.html', confirmed: true }],
        },
      })
    )
    const manual = loadManualSources(tmpFile, 12)
    assert.equal(manual.length, 2)
    assert.equal(manual[1].confirmed, true)

    const fakeFetch = async (url) => {
      if (url.includes('bing.com')) {
        return new Response(
          `<rss><channel><item><title>TV broadcast maps and announcers for Week 12</title><link>https://www.bing.com/news/apiclick.aspx?url=${encodeURIComponent('https://sports.yahoo.com/nfl/articles/bing-week-12.html')}</link></item></channel></rss>`,
          { status: 200 }
        )
      }
      if (url.includes('awfulannouncing.com/search')) {
        return new Response(
          `<rss><channel><item><title>Your 2026 NFL Week 12 announcing schedule</title><link>https://awfulannouncing.com/nfl/aa-rss-week-12.html</link></item></channel></rss>`,
          { status: 200 }
        )
      }
      if (url.includes('html.duckduckgo.com')) {
        return new Response(
          `<a class="result__a" href="https://html.duckduckgo.com/l/?uddg=${encodeURIComponent('https://awfulannouncing.com/nfl/ddg-week-12.html')}">NFL Week 12 announcing schedule</a>`,
          { status: 200 }
        )
      }
      return new Response('', { status: 404 })
    }

    const found = await discoverArticles(12, {
      season: 2026,
      urlOverrides: ['https://sports.yahoo.com/nfl/articles/cli-override.html'],
      sourcesFile: tmpFile,
      fetchFn: fakeFetch,
    })

    const urls = found.map((f) => f.url)
    assert.equal(urls[0], 'https://sports.yahoo.com/nfl/articles/cli-override.html')
    assert.equal(urls[1], 'https://sports.yahoo.com/nfl/articles/global-week-12.html')
    assert.equal(urls[2], 'https://awfulannouncing.com/nfl/manual-week-12.html')
    assert.ok(urls.includes('https://sports.yahoo.com/nfl/articles/bing-week-12.html'))
    assert.ok(urls.includes('https://awfulannouncing.com/nfl/aa-rss-week-12.html'))
    assert.ok(urls.includes('https://awfulannouncing.com/nfl/ddg-week-12.html'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Helper invariants: parseCrew role normalization and canonicalNetwork cover holiday platforms', () => {
  assert.equal(canonicalNetwork('Netflix'), 'Netflix')
  assert.equal(canonicalNetwork('Peacock'), 'Peacock')
  assert.equal(canonicalNetwork('YouTube TV'), 'YouTube')
  assert.equal(canonicalNetwork('Prime Video'), 'Amazon Prime Video')

  const noComma = parseCrew('Kevin Burkhardt (play-by-play), Tom Brady (analyst) Erin Andrews (reporter)')
  assert.deepEqual(noComma, {
    playByPlay: 'Kevin Burkhardt',
    analysts: ['Tom Brady'],
    sideline: ['Erin Andrews'],
    hasRoleTags: true,
  })
  assert.equal(crewsAgree(noComma, parseCrew('Kevin Burkhardt, Tom Brady, Erin Andrews')), true)
})
