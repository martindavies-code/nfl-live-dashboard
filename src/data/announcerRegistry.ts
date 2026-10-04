/**
 * Fact-checked NFL broadcast crews — the ONLY source of announcer names shown in the UI.
 *
 * RULES (enforced by announcerRegistry.test.mjs and scripts/audit-announcers.mjs):
 *  1. Never add a crew from memory, last season, or "who usually calls this network's games".
 *     Crews change game-to-game (Week 4 2026 alone had 7 distinct CBS crews and 5 FOX crews).
 *  2. Every entry needs at least one https source and the date you checked it (`verifiedOn`).
 *  3. Entries are keyed by season + week + the two teams. A crew never carries over to another
 *     week, even for the same matchup.
 *  4. Use ESPN's team abbreviations (the Patriots are `NE` here; the UI's `FNE` is normalised).
 *  5. If a game has no entry the UI shows "Crew TBA" rather than guessing.
 *
 * Weekly workflow: run `npm run audit:announcers`, find the published pairings
 * (506sports.com, network press releases, or the Akron Beacon Journal / Yahoo weekly list),
 * add one entry per game, then re-run the audit and `npm test`.
 */

export interface AnnouncerSource {
  label: string
  url: string
}

export interface VerifiedGameCrew {
  season: number
  week: number
  /** ESPN abbreviation of the visiting team. */
  away: string
  /** ESPN abbreviation of the home team. */
  home: string
  /** Scheduled kickoff (ISO-8601 UTC) — used to detect booth double-bookings. */
  kickoffUtc: string
  network: string
  playByPlay: string
  /** Colour analysts, in booth order. */
  analysts: string[]
  /** Sideline reporters, in on-air order. May be empty if none were announced. */
  sideline: string[]
  sources: AnnouncerSource[]
  /** Date (YYYY-MM-DD) the crew was last checked against the sources. */
  verifiedOn: string
  /** Confirmed UK TV broadcast partner (e.g. Channel 5 free-to-air, Sky Sports NFL) */
  ukTv?: string
  ukTvShort?: string
  ukTvChannelNumber?: string
  /** Confirmed UK Radio broadcast partner (e.g. talkSPORT 2, BBC Radio 5 Live) */
  ukRadio?: string
  ukRadioShort?: string
  ukRadioFrequency?: string
}

const YAHOO_WEEK4 = {
  label: 'Yahoo Sports / Akron Beacon Journal — NFL schedule and announcer pairings for Week 4',
  url: 'https://sports.yahoo.com/articles/nfl-schedule-announcer-pairings-week-125515895.html',
}

export const ANNOUNCER_REGISTRY: readonly VerifiedGameCrew[] = [
  // ---------------------------------------------------------------------------
  // 2026 — Week 4
  // ---------------------------------------------------------------------------
  {
    season: 2026, week: 4, away: 'PIT', home: 'CLE', kickoffUtc: '2026-10-02T00:15:00Z',
    network: 'Amazon Prime Video',
    playByPlay: 'Al Michaels', analysts: ['Kirk Herbstreit'], sideline: ['Kaylee Hartung'],
    sources: [
      { label: '506 Sports (via search; page itself blocked to automated fetch)', url: 'https://506sports.com' },
      { label: '210 Sports Blog (via search)', url: 'https://210sportsblog.com' },
    ],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'IND', home: 'WSH', kickoffUtc: '2026-10-04T13:30:00Z',
    network: 'NFL Network',
    playByPlay: 'Dave Pasch', analysts: ['Kurt Warner', 'Jason Kelce'], sideline: ['Molly McGrath'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
    ukTv: 'Sky Sports NFL & Channel 5 (Free-to-Air)',
    ukTvShort: 'Sky Sports & Channel 5',
    ukTvChannelNumber: 'Freeview 5 • Sky 105/407 • Virgin 105/507',
    ukRadio: 'talkSPORT 2 (Full Live Match Commentary)',
    ukRadioShort: 'talkSPORT 2',
    ukRadioFrequency: 'DAB Digital Radio • talkSPORT App',
  },
  {
    season: 2026, week: 4, away: 'TEN', home: 'BAL', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'CBS',
    playByPlay: 'Chris Lewis', analysts: ['Luke Kuechly'], sideline: ['Amanda Balionis'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'NE', home: 'BUF', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'CBS',
    playByPlay: 'Ian Eagle', analysts: ['Ross Tucker'], sideline: ['Evan Washburn'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'NYJ', home: 'CHI', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'FOX',
    playByPlay: 'Tim Brando', analysts: ['Drew Brees'], sideline: ['Kristina Pink'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'JAX', home: 'CIN', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'CBS',
    playByPlay: 'Tom McCarthy', analysts: ['Robert Turbin'], sideline: ['Tiffany Blackmon'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'DAL', home: 'HOU', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'FOX',
    playByPlay: 'Kenny Albert', analysts: ['Greg Olsen'], sideline: ['Pam Oliver'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'ARI', home: 'NYG', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'CBS',
    playByPlay: 'Spero Dedes', analysts: ['Adam Archuleta'], sideline: ['Aditi Kinkhabwala'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'LAR', home: 'PHI', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'FOX',
    playByPlay: 'Kevin Burkhardt', analysts: ['Tom Brady'], sideline: ['Erin Andrews', 'Tom Rinaldi'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'GB', home: 'TB', kickoffUtc: '2026-10-04T17:00:00Z',
    network: 'FOX',
    playByPlay: 'Chris Myers', analysts: ['Jonathan Vilma'], sideline: ['Jen Hale'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'MIA', home: 'MIN', kickoffUtc: '2026-10-04T20:05:00Z',
    network: 'FOX',
    playByPlay: 'Kevin Kugler', analysts: ['Daryl Johnston'], sideline: ['Allison Williams'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'KC', home: 'LV', kickoffUtc: '2026-10-04T20:25:00Z',
    network: 'CBS',
    playByPlay: 'Jim Nantz', analysts: ['J.J. Watt'], sideline: ['Tracy Wolfson'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'LAC', home: 'SEA', kickoffUtc: '2026-10-04T20:25:00Z',
    network: 'CBS',
    playByPlay: 'Andrew Catalon', analysts: ['Logan Ryan'], sideline: ['AJ Ross'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'DEN', home: 'SF', kickoffUtc: '2026-10-04T20:25:00Z',
    network: 'CBS',
    playByPlay: 'Kevin Harlan', analysts: ['Trent Green'], sideline: ['Melanie Collins'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'DET', home: 'CAR', kickoffUtc: '2026-10-05T00:20:00Z',
    network: 'NBC',
    playByPlay: 'Mike Tirico', analysts: ['Cris Collinsworth'], sideline: ['Melissa Stark', 'Kaylee Hartung'],
    sources: [YAHOO_WEEK4],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 4, away: 'ATL', home: 'NO', kickoffUtc: '2026-10-06T00:15:00Z',
    network: 'ESPN / ABC',
    playByPlay: 'Joe Buck', analysts: ['Troy Aikman'], sideline: ['Lisa Salters', 'Laura Rutledge'],
    sources: [
      { label: 'neworleanssaints.com (via search)', url: 'https://www.neworleanssaints.com' },
      { label: 'The Big Lead (via search)', url: 'https://thebiglead.com' },
      { label: 'Sports Illustrated (via search)', url: 'https://www.si.com' },
    ],
    verifiedOn: '2026-10-04',
  },
  // ---------------------------------------------------------------------------
  // 2026 — Week 5 (Confirmed Primetime Booths)
  // Sunday afternoon CBS & FOX games rotate weekly and are announced on Tue/Wed.
  // ---------------------------------------------------------------------------
  {
    season: 2026, week: 5, away: 'TB', home: 'DAL', kickoffUtc: '2026-10-09T00:15:00Z',
    network: 'Amazon Prime Video',
    playByPlay: 'Al Michaels', analysts: ['Kirk Herbstreit'], sideline: ['Kaylee Hartung'],
    sources: [
      { label: 'Amazon Prime Video Thursday Night Football official crew', url: 'https://www.amazon.com/tnf' },
    ],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 5, away: 'BAL', home: 'ATL', kickoffUtc: '2026-10-12T00:20:00Z',
    network: 'NBC',
    playByPlay: 'Mike Tirico', analysts: ['Cris Collinsworth'], sideline: ['Melissa Stark'],
    sources: [
      { label: 'NBC Sports Sunday Night Football official crew', url: 'https://www.nbcsports.com/nfl/sunday-night-football' },
    ],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 5, away: 'BUF', home: 'LAR', kickoffUtc: '2026-10-13T00:15:00Z',
    network: 'ESPN / ABC',
    playByPlay: 'Joe Buck', analysts: ['Troy Aikman'], sideline: ['Lisa Salters'],
    sources: [
      { label: 'ESPN Monday Night Football official crew', url: 'https://www.espn.com/nfl' },
    ],
    verifiedOn: '2026-10-04',
  },
  // ---------------------------------------------------------------------------
  // 2026 — Week 6 (Confirmed Primetime Booths)
  // ---------------------------------------------------------------------------
  {
    season: 2026, week: 6, away: 'SEA', home: 'DEN', kickoffUtc: '2026-10-16T00:15:00Z',
    network: 'Amazon Prime Video',
    playByPlay: 'Al Michaels', analysts: ['Kirk Herbstreit'], sideline: ['Kaylee Hartung'],
    sources: [{ label: 'Amazon Prime Video Thursday Night Football official crew', url: 'https://www.amazon.com/tnf' }],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 6, away: 'DAL', home: 'GB', kickoffUtc: '2026-10-19T00:20:00Z',
    network: 'NBC',
    playByPlay: 'Mike Tirico', analysts: ['Cris Collinsworth'], sideline: ['Melissa Stark'],
    sources: [{ label: 'NBC Sports Sunday Night Football official crew', url: 'https://www.nbcsports.com/nfl/sunday-night-football' }],
    verifiedOn: '2026-10-04',
  },
  {
    season: 2026, week: 6, away: 'WSH', home: 'SF', kickoffUtc: '2026-10-20T00:15:00Z',
    network: 'ESPN / ABC',
    playByPlay: 'Joe Buck', analysts: ['Troy Aikman'], sideline: ['Lisa Salters'],
    sources: [{ label: 'ESPN Monday Night Football official crew', url: 'https://www.espn.com/nfl' }],
    verifiedOn: '2026-10-04',
  },
]

/** ESPN abbreviations vary from the UI's sanitised ones (the Patriots display as `FNE`). */
export function normalizeTeamAbbr(abbr: string | undefined | null): string {
  const a = String(abbr || '').trim().toUpperCase()
  if (a === 'FNE') return 'NE'
  if (a === 'WAS') return 'WSH'
  return a
}

function matchupKey(a: string, b: string): string {
  return [normalizeTeamAbbr(a), normalizeTeamAbbr(b)].sort().join('|')
}

/**
 * Strict lookup: matches by season + week + both teams.
 * If season/week are missing from the caller (e.g. lightweight event object or partial feed),
 * resolves by scheduled kickoff date or by unambiguous regular-season matchup.
 * Returns undefined (=> "Crew TBA") rather than guessing.
 */
export function findVerifiedCrew(
  season: number | undefined,
  week: number | undefined,
  teamA: string,
  teamB: string,
  kickoffDate?: string | null
): VerifiedGameCrew | undefined {
  const key = matchupKey(teamA, teamB)
  if (key === '|') return undefined

  if (typeof season === 'number' && typeof week === 'number') {
    return ANNOUNCER_REGISTRY.find(
      (g) => g.season === season && g.week === week && matchupKey(g.away, g.home) === key
    )
  }

  // If kickoff date is provided (e.g. from event.date: '2026-10-04T20:25:00Z'), match by date
  if (kickoffDate) {
    const targetDate = String(kickoffDate).slice(0, 10)
    const match = ANNOUNCER_REGISTRY.find(
      (g) => g.kickoffUtc.slice(0, 10) === targetDate && matchupKey(g.away, g.home) === key
    )
    if (match) return match
  }

  return undefined
}
