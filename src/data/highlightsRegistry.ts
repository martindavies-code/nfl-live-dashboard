import { sanitizePatriotsAbbreviation } from '../utils/nflHelpers.ts'

export interface RegisteredHighlight {
  videoId: string
  title: string
  kickoffUtc?: string
}

/**
 * Authoritative registry of official NFL YouTube game highlight videos.
 * Published directly by the official NFL YouTube channel (@nfl).
 *
 * Key format: `${seasonYear}_${seasonType}_${weekNumber}_${awayAbbr}_${homeAbbr}`
 * where seasonType is 'REG' or 'POST'.
 */
export const HIGHLIGHTS_REGISTRY: Record<string, RegisteredHighlight> = {
  // =========================================================================
  // 2026 Regular Season - Week 1 (16 Official NFL Highlights)
  // =========================================================================
  '2026_REG_1_NE_SEA': {
    videoId: 'hyEng1b5j8o',
    title: 'New England Patriots vs. Seattle Seahawks Game Highlights Week 1 | NFL 2026',
    kickoffUtc: '2026-09-10T00:20Z',
  },
  '2026_REG_1_SF_LAR': {
    videoId: 'C9sL5j_iUiE',
    title: 'San Francisco 49ers vs Los Angeles Rams Game Highlights | 2026 Week 1 Melbourne Game',
    kickoffUtc: '2026-09-11T00:35Z',
  },
  '2026_REG_1_TB_CIN': {
    videoId: '6Jc-OI39Qng',
    title: 'Tampa Bay Buccaneers vs. Cincinnati Bengals Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_NYJ_TEN': {
    videoId: 'vt9DKUJ_Q-Y',
    title: 'New York Jets vs Tennessee Titans Game Highlights | NFL 2026 Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_NO_DET': {
    videoId: 'KC4OW2m3hjs',
    title: 'New Orleans Saints vs. Detroit Lions Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_BAL_IND': {
    videoId: 'iyDolDtuiT0',
    title: 'Baltimore Ravens vs. Indianapolis Colts Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_CHI_CAR': {
    videoId: 'gXmzn5ZBsHU',
    title: 'Chicago Bears vs Carolina Panthers Game Highlights | NFL 2026 Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_ATL_PIT': {
    videoId: 'TQcletbGnAk',
    title: 'Atlanta Falcons vs. Pittsburgh Steelers Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_CLE_JAX': {
    videoId: 'T5D7UViL1L0',
    title: 'Cleveland Browns vs Jacksonville Jaguars Game Highlights | NFL 2026 Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_BUF_HOU': {
    videoId: 'X3AZfHgZXFE',
    title: 'Buffalo Bills vs. Houston Texans Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T17:00Z',
  },
  '2026_REG_1_MIA_LV': {
    videoId: 'bi4dvOh4tPA',
    title: 'Miami Dolphins vs Las Vegas Raiders Game Highlights | 2026 NFL Week 1',
    kickoffUtc: '2026-09-13T20:25Z',
  },
  '2026_REG_1_ARI_LAC': {
    videoId: 'UKqM7fT42uk',
    title: 'Arizona Cardinals vs. Los Angeles Chargers Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T20:25Z',
  },
  '2026_REG_1_WSH_PHI': {
    videoId: 'UYunnfDMXGc',
    title: 'Washington Commanders vs Philadelphia Eagles Game Highlights | 2026 NFL Week 1',
    kickoffUtc: '2026-09-13T20:25Z',
  },
  '2026_REG_1_GB_MIN': {
    videoId: 'd6wKdU-5kME',
    title: 'Green Bay Packers vs. Minnesota Vikings Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-13T20:25Z',
  },
  '2026_REG_1_DAL_NYG': {
    videoId: '9R8P93W2iKE',
    title: 'Dallas Cowboys vs New York Giants Game Highlights | NFL 2026 Season Week 1',
    kickoffUtc: '2026-09-14T00:20Z',
  },
  '2026_REG_1_DEN_KC': {
    videoId: 'RYh8_uw45Fw',
    title: 'Denver Broncos vs Kansas City Chiefs Game Highlights | 2026 NFL Season Week 1',
    kickoffUtc: '2026-09-15T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 2 (16 Official NFL Highlights)
  // =========================================================================
  '2026_REG_2_DET_BUF': {
    videoId: 'ULjOfKcZl4o',
    title: 'Detroit Lions vs Buffalo Bills Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-18T00:15Z',
  },
  '2026_REG_2_MIN_CHI': {
    videoId: 'hwqFHBP3_VM',
    title: 'Minnesota Vikings vs. Chicago Bears Game Highlights | NFL 2026 Season Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_CAR_ATL': {
    videoId: '6zdUT_bY1Gg',
    title: 'Carolina Panthers vs. Atlanta Falcons Game Highlights | NFL Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_PHI_TEN': {
    videoId: 'qQFyOm6nFaE',
    title: 'Philadelphia Eagles vs Tennessee Titans Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_PIT_NE': {
    videoId: 'HMeTHt77nYE',
    title: 'Pittsburgh Steelers vs. New England Patriots Game Highlights | NFL Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_GB_NYJ': {
    videoId: 'Z7OIS7hXV7E',
    title: 'Green Bay Packers vs. New York Jets Game Highlights | NFL 2026 Season Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_CLE_TB': {
    videoId: 'Q5PgGZKMUqk',
    title: 'Cleveland Browns vs Tampa Bay Buccaneers Game Highlights',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_NO_BAL': {
    videoId: 'ZhFUgsuEgV4',
    title: 'New Orleans Saints vs. Baltimore Ravens Game Highlights | NFL 2026 Season Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_CIN_HOU': {
    videoId: 'Bi13ofXC0xY',
    title: 'Cincinnati Bengals vs Houston Texans Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-20T17:00Z',
  },
  '2026_REG_2_JAX_DEN': {
    videoId: 'bGoj6Mktog0',
    title: 'Jacksonville Jaguars vs. Denver Broncos Game Highlights | NFL 2026 Season Week 2',
    kickoffUtc: '2026-09-20T20:05Z',
  },
  '2026_REG_2_LV_LAC': {
    videoId: 'cyk5Vci3k-c',
    title: 'Las Vegas Raiders vs Los Angeles Chargers Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-20T20:05Z',
  },
  '2026_REG_2_WSH_DAL': {
    videoId: 's6KiKu6PZgk',
    title: 'Washington Commanders vs Dallas Cowboys Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-20T20:25Z',
  },
  '2026_REG_2_SEA_ARI': {
    videoId: '_k-w90zF8t4',
    title: 'Seattle Seahawks vs. Arizona Cardinals Game Highlights | NFL 2026 Season Week 2',
    kickoffUtc: '2026-09-20T20:25Z',
  },
  '2026_REG_2_MIA_SF': {
    videoId: 'pV8FmQa0a5w',
    title: 'Miami Dolphins vs. San Francisco 49ers Game Highlights | NFL 2026 Week 2',
    kickoffUtc: '2026-09-20T20:25Z',
  },
  '2026_REG_2_IND_KC': {
    videoId: 'baPzspvJv5Q',
    title: 'Indianapolis Colts vs Kansas City Chiefs Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-21T00:20Z',
  },
  '2026_REG_2_NYG_LAR': {
    videoId: 'qg9GZqmTRto',
    title: 'New York Giants vs Los Angeles Rams Game Highlights | 2026 NFL Season Week 2',
    kickoffUtc: '2026-09-22T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 3 (16 Official NFL Highlights)
  // =========================================================================
  '2026_REG_3_ATL_GB': {
    videoId: 'sbXZBAUOkDw',
    title: 'Atlanta Falcons vs Green Bay Packers Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-25T00:15Z',
  },
  '2026_REG_3_LAC_BUF': {
    videoId: 'v__pg6qIYL4',
    title: 'Los Angeles Chargers vs. Buffalo Bills Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_CAR_CLE': {
    videoId: 'EyGW6pqjIgs',
    title: 'Carolina Panthers vs. Cleveland Browns Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_HOU_IND': {
    videoId: 'LwBJf78vzjY',
    title: 'Houston Texans vs Indianapolis Colts Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_NYJ_DET': {
    videoId: 'xsJzYyK4mGE',
    title: 'New York Jets vs. Detroit Lions Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_KC_MIA': {
    videoId: 'eyM7QUODW6c',
    title: 'Kansas City Chiefs vs. Miami Dolphins Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_TEN_NYG': {
    videoId: 'GmCLbwLRGqA',
    title: 'Tennessee Titans vs. New York Giants Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_CIN_PIT': {
    videoId: 'sqOhOfjHhaI',
    title: 'Cincinnati Bengals vs. Pittsburgh Steelers Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_SEA_WSH': {
    videoId: 'j8mZDG_M7cs',
    title: 'Seattle Seahawks vs Washington Commanders Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_NE_JAX': {
    videoId: 'Oi9HQlp-ysA',
    title: 'New England Patriots vs Jacksonville Jaguars Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-27T17:00Z',
  },
  '2026_REG_3_MIN_TB': {
    videoId: 'PwKZhQg5n6w',
    title: 'Minnesota Vikings vs Tampa Bay Buccaneers Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-27T20:05Z',
  },
  '2026_REG_3_ARI_SF': {
    videoId: '7ngu-tT0PQs',
    title: 'Arizona Cardinals vs. San Francisco 49ers Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T20:05Z',
  },
  '2026_REG_3_BAL_DAL': {
    videoId: '7gWPdESD1og',
    title: 'Baltimore Ravens vs Dallas Cowboys Game Highlights from Rio | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-27T20:25Z',
  },
  '2026_REG_3_LV_NO': {
    videoId: 'xcj0NwyEJUk',
    title: 'Las Vegas Raiders vs. New Orleans Saints Game Highlights | NFL 2026 Season Week 3',
    kickoffUtc: '2026-09-27T20:25Z',
  },
  '2026_REG_3_LAR_DEN': {
    videoId: 'EL-uDgYSYlI',
    title: 'Los Angeles Rams vs Denver Broncos Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-28T00:20Z',
  },
  '2026_REG_3_PHI_CHI': {
    videoId: 'KScULet1ves',
    title: 'Philadelphia Eagles vs. Chicago Bears Game Highlights | 2026 NFL Season Week 3',
    kickoffUtc: '2026-09-29T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 4 (16 Official NFL Highlights)
  // =========================================================================
  '2026_REG_4_PIT_CLE': {
    videoId: 'qJn2zHTs9BY',
    title: 'Pittsburgh Steelers vs Cleveland Browns Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-02T00:15Z',
  },
  '2026_REG_4_IND_WSH': {
    videoId: 'VSkRsq4Tlfg',
    title: 'Indianapolis Colts vs. Washington Commanders Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-04T13:30Z',
  },
  '2026_REG_4_NE_BUF': {
    videoId: 'Z5zAM_GLGI0',
    title: 'New England Patriots vs. Buffalo Bills Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_NYJ_CHI': {
    videoId: 'IlcC1zFWyVw',
    title: 'New York Jets vs. Chicago Bears Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_JAX_CIN': {
    videoId: 'a2zogEoiXV0',
    title: 'Jacksonville Jaguars vs Cincinnati Bengals Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_ARI_NYG': {
    videoId: 'OdvCc-cxRz4',
    title: 'Arizona Cardinals vs. New York Giants Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_LAR_PHI': {
    videoId: 'h6eywSmXaCI',
    title: 'Los Angeles Rams vs. Philadelphia Eagles Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_GB_TB': {
    videoId: '13AbO1AEq1E',
    title: 'Green Bay Packers vs Tampa Bay Buccaneers Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_TEN_BAL': {
    videoId: '1MzoImgClWQ',
    title: 'Tennessee Titans vs Baltimore Ravens Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_DAL_HOU': {
    videoId: 'Yayn1UWwu1Y',
    title: 'Dallas Cowboys vs. Houston Texans Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T17:00Z',
  },
  '2026_REG_4_MIA_MIN': {
    videoId: 'YHo13wCIHT4',
    title: 'Miami Dolphins vs Minnesota Vikings Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-04T20:05Z',
  },
  '2026_REG_4_DEN_SF': {
    videoId: '3T1_zYMHPaQ',
    title: 'Denver Broncos vs San Francisco 49ers Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-04T20:25Z',
  },
  '2026_REG_4_LAC_SEA': {
    videoId: 'a0oq3jtgsvE',
    title: 'Los Angeles Chargers vs. Seattle Seahawks Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T20:25Z',
  },
  '2026_REG_4_KC_LV': {
    videoId: 'UH-pYLB0KQ4',
    title: 'Kansas City Chiefs vs. Las Vegas Raiders Game Highlights | NFL 2026 Season Week 4',
    kickoffUtc: '2026-10-04T20:25Z',
  },
  '2026_REG_4_DET_CAR': {
    videoId: 'sD0WZLGybRw',
    title: 'Detroit Lions vs Carolina Panthers Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-05T00:20Z',
  },
  '2026_REG_4_ATL_NO': {
    videoId: '8qB8fHEgpkg',
    title: 'Atlanta Falcons vs New Orleans Saints Game Highlights | 2026 NFL Season Week 4',
    kickoffUtc: '2026-10-06T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 5 (15 Official NFL Highlights)
  // =========================================================================
  '2026_REG_5_TB_DAL': {
    videoId: 'OmJqJI7pJpI',
    title: 'Tampa Bay Buccaneers vs Dallas Cowboys Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-09T00:15Z',
  },
  '2026_REG_5_PHI_JAX': {
    videoId: 'WXw2IIj01Sg',
    title: 'Philadelphia Eagles vs. Jacksonville Jaguars Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T13:30Z',
  },
  '2026_REG_5_CHI_GB': {
    videoId: 'SWAC-z8sGjQ',
    title: 'Chicago Bears vs. Green Bay Packers Game Highlights | NFL 2026 Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_HOU_TEN': {
    videoId: 'K4ZVwiL_Tf4',
    title: 'Houston Texans vs. Tennessee Titans Game Highlights | NFL 2026 Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_CIN_MIA': {
    videoId: 'veMELeUzxeo',
    title: 'Cincinnati Bengals vs Miami Dolphins Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_LV_NE': {
    videoId: 'fLKLrtqun84',
    title: 'Las Vegas Raiders vs. New England Patriots Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_MIN_NO': {
    videoId: 'OeaSf-kDpYA',
    title: 'Minnesota Vikings vs New Orleans Saint Game Highlights | NFL 2026 Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_CLE_NYJ': {
    videoId: 'p_DHFA3Sfys',
    title: 'Cleveland Browns vs New York Jets Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_IND_PIT': {
    videoId: 'padeBx3DEdM',
    title: 'Indianapolis Colts vs. Pittsburgh Steelers Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_NYG_WSH': {
    videoId: 'E9KI_S2-vwo',
    title: 'New York Giants vs Washington Commanders Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T17:00Z',
  },
  '2026_REG_5_DEN_LAC': {
    videoId: 'EjqZq2newqk',
    title: 'Denver Broncos vs. Los Angeles Chargers Game Highlights | NFL 2026 Season Week 5',
    kickoffUtc: '2026-10-11T20:05Z',
  },
  '2026_REG_5_DET_ARI': {
    videoId: 'a7ixKMcIHHs',
    title: 'Detroit Lions vs. Arizona Cardinals Game Highlights | NFL 2026 Week 5',
    kickoffUtc: '2026-10-11T20:25Z',
  },
  '2026_REG_5_SF_SEA': {
    videoId: 'B1hjRUzIduc',
    title: 'San Francisco 49ers vs Seattle Seahawks Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-11T20:25Z',
  },
  '2026_REG_5_BAL_ATL': {
    videoId: 'fVlmow2jCDA',
    title: 'Baltimore Ravens vs Atlanta Falcons Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-12T00:20Z',
  },
  '2026_REG_5_BUF_LAR': {
    videoId: 'GP9zR_SKRr0',
    title: 'Buffalo Bills vs Los Angeles Rams Game Highlights | 2026 NFL Season Week 5',
    kickoffUtc: '2026-10-13T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 6 (14 Official NFL Highlights)
  // =========================================================================
  '2026_REG_6_SEA_DEN': {
    videoId: '6uFD3NGt0GE',
    title: 'Seattle Seahawks vs Denver Broncos Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-16T00:15Z',
  },
  '2026_REG_6_HOU_JAX': {
    videoId: 'SQT1S7J4s-o',
    title: 'Houston Texans vs. Jacksonville Jaguars Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T13:30Z',
  },
  '2026_REG_6_CHI_ATL': {
    videoId: 'H82sLvw_lcU',
    title: 'Chicago Bears vs Atlanta Falcons Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_BAL_CLE': {
    videoId: 'agBZnbbPCq0',
    title: 'Baltimore Ravens vs. Cleveland Browns Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_NYJ_NE': {
    videoId: 'CDcGaEkMy6s',
    title: 'New York Jets vs New England Patriots Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_TEN_IND': {
    videoId: 'MJZhpnKoY7E',
    title: 'Tennessee Titans vs Indianapolis Colts Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_PIT_TB': {
    videoId: 'vf4ksuXiQ1M',
    title: 'Pittsburgh Steelers vs. Tampa Bay Buccaneers Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_NO_NYG': {
    videoId: 'a1M5YngTbus',
    title: 'New Orleans Saints vs. New York Giants Game Highlights | NFL 2026 Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_CAR_PHI': {
    videoId: '7x-qq154bgs',
    title: 'Carolina Panthers vs. Philadelphia Eagles Game Highlights | NFL 2026 Season Week 6',
    kickoffUtc: '2026-10-18T17:00Z',
  },
  '2026_REG_6_ARI_LAR': {
    videoId: 'kXX4xq2el10',
    title: 'Arizona Cardinals vs. Los Angeles Rams Game Highlights | NFL 2026 Season Week 6',
    kickoffUtc: '2026-10-18T20:05Z',
  },
  '2026_REG_6_BUF_LV': {
    videoId: 'JCwv4Mrkdd8',
    title: 'Buffalo Bills vs. Las Vegas Raiders Game Highlights | NFL 2026 Season Week 6',
    kickoffUtc: '2026-10-18T20:25Z',
  },
  '2026_REG_6_LAC_KC': {
    videoId: 'B5OVcasfeTU',
    title: 'Los Angeles Chargers vs Kansas City Chiefs Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-18T20:25Z',
  },
  '2026_REG_6_DAL_GB': {
    videoId: '5xB0vJWbJG4',
    title: 'Dallas Cowboys vs Green Bay Packers Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-19T00:20Z',
  },
  '2026_REG_6_WSH_SF': {
    videoId: 'EM4Bq_uqLQ0',
    title: 'Washington Commanders vs San Francisco 49ers Game Highlights | 2026 NFL Season Week 6',
    kickoffUtc: '2026-10-20T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 7 (14 Official NFL Highlights)
  // =========================================================================
  '2026_REG_7_NE_CHI': {
    videoId: 'Urfce838vEc',
    title: 'New England Patriots vs Chicago Bears Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-23T00:15Z',
  },
  '2026_REG_7_PIT_NO': {
    videoId: 'wz6HQi6XPDc',
    title: 'Pittsburgh Steelers vs. New Orleans Saints Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T13:30Z',
  },
  '2026_REG_7_SF_ATL': {
    videoId: '6PDASNSZQFI',
    title: 'San Francisco 49ers vs Atlanta Falcons Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_MIA_NYJ': {
    videoId: 'iXW84N92-vE',
    title: 'Miami Dolphins vs. New York Jets Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_CLE_TEN': {
    videoId: '_4OJ6iu8K1I',
    title: 'Cleveland Browns vs. Tennessee Titans Game Highlights | NFL 2026 Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_IND_MIN': {
    videoId: '4PyjDuD7-4I',
    title: 'Indianapolis Colts vs. Minnesota Vikings Game Highlights | NFL 2026 Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_CIN_BAL': {
    videoId: 'LJRRMbR4BrE',
    title: 'Cincinnati Bengals vs. Baltimore Ravens Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_TB_CAR': {
    videoId: 'KHLfLsKZlRg',
    title: 'Tampa Bay Buccaneers vs Carolina Panthers Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_NYG_HOU': {
    videoId: 'oy5jJycVydI',
    title: 'New York Giants vs Houston Texans Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T17:00Z',
  },
  '2026_REG_7_DEN_ARI': {
    videoId: 'ELahNguVTLM',
    title: 'Denver Broncos vs Arizona Cardinals Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T20:05Z',
  },
  '2026_REG_7_GB_DET': {
    videoId: 'r3NBIs-ABLA',
    title: 'Green Bay Packers vs Detroit Lions Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-25T20:25Z',
  },
  '2026_REG_7_LAR_LV': {
    videoId: '7RnrZzPJUJ0',
    title: 'Los Angeles Rams vs. Las Vegas Raiders Game Highlights | NFL 2026 Season Week 7',
    kickoffUtc: '2026-10-25T20:25Z',
  },
  '2026_REG_7_KC_SEA': {
    videoId: 'dIfN83Krivs',
    title: 'Kansas City Chiefs vs. Seattle Seahawks Game Highlights | NFL 2026 Season Week 7',
    kickoffUtc: '2026-10-26T00:20Z',
  },
  '2026_REG_7_DAL_PHI': {
    videoId: '6Hdk00wyWZk',
    title: 'Dallas Cowboys vs Philadelphia Eagles Game Highlights | 2026 NFL Season Week 7',
    kickoffUtc: '2026-10-27T00:15Z',
  },

  // =========================================================================
  // 2026 Regular Season - Week 8 (14 Official NFL Highlights)
  // =========================================================================
  '2026_REG_8_CAR_GB': {
    videoId: 'L6m1RUIXLB4',
    title: 'Carolina Panthers vs Green Bay Packers Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-10-30T00:15Z',
  },
  '2026_REG_8_BAL_BUF': {
    videoId: '3xMS3qL2KwY',
    title: 'Baltimore Ravens vs Buffalo Bills Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_ARI_DAL': {
    videoId: '5qorFNyHsiM',
    title: 'Arizona Cardinals vs. Dallas Cowboys Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_MIN_DET': {
    videoId: 'pB59Bt0uklY',
    title: 'Minnesota Vikings vs. Detroit Lions Game Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_TEN_CIN': {
    videoId: 'fZ27uy5PB7I',
    title: 'Tennessee Titans vs Cincinnati Bengals Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_CLE_PIT': {
    videoId: '_tkkFK0248w',
    title: 'Cleveland Browns vs. Pittsburgh Steelers Game Highlights | NFL 2026 Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_LV_NYJ': {
    videoId: '-fuyn2BZZAI',
    title: 'Las Vegas Raiders vs. New York Jets Game Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_IND_JAX': {
    videoId: 'R7zUguz0Aag',
    title: 'Indianapolis Colts vs. Jacksonville Jaguars Game Highlights | NFL 2026 Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_ATL_TB': {
    videoId: 'lGnOFwQPXD4',
    title: 'Atlanta Falcons vs. Tampa Bay Buccaneers Game Highlights | NFL 2026 Week 8',
    kickoffUtc: '2026-11-01T18:00Z',
  },
  '2026_REG_8_LAC_LAR': {
    videoId: 'Z5w0O7Jprdk',
    title: 'Los Angeles Chargers vs Los Angeles Rams Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T21:05Z',
  },
  '2026_REG_8_NE_MIA': {
    videoId: 'EL_8uTSc1PY',
    title: 'New England Patriots vs Miami Dolphins Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-01T21:25Z',
  },
  '2026_REG_8_KC_DEN': {
    videoId: 'Tj71A_YItgE',
    title: 'Kansas City Chiefs vs. Denver Broncos Game Highlights | NFL 2026 Season Week 8',
    kickoffUtc: '2026-11-01T21:25Z',
  },
  '2026_REG_8_PHI_WSH': {
    videoId: '40wesZPReUc',
    title: 'Philadelphia Eagles vs Washington Commanders Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-02T01:20Z',
  },
  '2026_REG_8_CHI_SEA': {
    videoId: 'j8XRNpYOsos',
    title: 'Chicago Bears vs Seattle Seahawks Game Highlights | 2026 NFL Season Week 8',
    kickoffUtc: '2026-11-03T01:15Z',
  },

}

/**
 * Normalizes team abbreviation for registry key lookup.
 * Automatically handles Patriots aliases (FNE -> NE) and upper-casing.
 */
export function normalizeHighlightAbbr(abbr?: string | null): string {
  if (!abbr || typeof abbr !== 'string') return ''
  const clean = abbr.trim().toUpperCase()
  if (clean === 'FNE' || clean === 'PATRIOTS') return 'NE'
  const sanitized = sanitizePatriotsAbbreviation(clean)
  if (sanitized === 'FNE') return 'NE'
  return clean
}

/**
 * Builds the canonical registry key for a given game.
 */
export function buildHighlightKey(
  seasonYear?: number | string | null,
  seasonType?: number | string | null,
  weekNumber?: number | string | null,
  awayAbbr: string = '',
  homeAbbr: string = ''
): string {
  const year = seasonYear ? String(seasonYear).trim() : '2026'
  const typeStr = Number(seasonType) === 3 ? 'POST' : 'REG'
  const week = weekNumber ? String(weekNumber).trim() : '1'
  const away = normalizeHighlightAbbr(awayAbbr)
  const home = normalizeHighlightAbbr(homeAbbr)
  return `${year}_${typeStr}_${week}_${away}_${home}`
}

/**
 * Looks up a registered official highlight video for a game.
 */
export function getRegisteredHighlight(
  seasonYear?: number | string | null,
  seasonType?: number | string | null,
  weekNumber?: number | string | null,
  awayAbbr?: string | null,
  homeAbbr?: string | null
): RegisteredHighlight | null {
  if (!awayAbbr || !homeAbbr) return null
  const key = buildHighlightKey(
    seasonYear ?? 2026,
    seasonType ?? 2,
    weekNumber ?? 1,
    awayAbbr,
    homeAbbr
  )
  return HIGHLIGHTS_REGISTRY[key] || null
}
