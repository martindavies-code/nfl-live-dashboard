export interface NFLTeam {
  id: string
  uid?: string
  name: string
  displayName: string
  abbreviation: string
  location?: string
  color: string // Hex string without '#'
  alternateColor?: string
  logo: string
}

export interface NFLCompetitor {
  id: string
  uid?: string
  homeAway: 'home' | 'away'
  winner?: boolean
  score: string
  records?: Array<{
    name?: string
    type?: string
    summary: string
  }>
  team: NFLTeam
  linescores?: Array<{ value: number }>
}

export interface NFLLastPlay {
  id: string
  text: string
  statYardage?: number
  scoreValue?: number
  team?: {
    id: string
  }
  type?: {
    id: string
    text: string
    abbreviation?: string
  }
  probability?: {
    tiePercentage?: number
    homeWinPercentage?: number
    awayWinPercentage?: number
    secondsLeft?: number
  }
  drive?: {
    description?: string
    start?: { yardLine: number; text: string }
    end?: { yardLine: number; text: string }
    timeElapsed?: { displayValue: string }
    result?: string
  }
}

export interface NFLSituation {
  lastPlay?: NFLLastPlay
  down: number // 1, 2, 3, 4, or -1 (kickoff/extra point)
  yardLine: number // 0 to 100 (0 = home goal, 100 = away goal in ESPN coordinates)
  distance: number // yards to first down
  downDistanceText?: string // e.g. "4th & 3 at CAR 38"
  shortDownDistanceText?: string // e.g. "4th & 3"
  possessionText?: string // e.g. "CAR 38"
  possession?: string // Team ID
  isRedZone?: boolean
  homeTimeouts?: number
  awayTimeouts?: number
}

export interface NFLStatusType {
  id: string
  name: string
  state: 'pre' | 'in' | 'post'
  completed: boolean
  description: string
  detail: string
  shortDetail: string
}

export interface NFLStatus {
  clock: number
  displayClock: string
  period: number // 1, 2, 3, 4, 5+
  type: NFLStatusType
}

export interface NFLBroadcast {
  market: string
  names: string[]
}

export interface NFLOdds {
  provider?: {
    id?: string
    name?: string
    displayName?: string
  }
  details?: string
  overUnder?: number
  spread?: number
  awayTeamOdds?: {
    favorite?: boolean
    underdog?: boolean
  }
  homeTeamOdds?: {
    favorite?: boolean
    underdog?: boolean
  }
  moneyline?: {
    home?: {
      close?: { odds?: string }
      open?: { odds?: string }
    }
    away?: {
      close?: { odds?: string }
      open?: { odds?: string }
    }
  }
}

export interface NFLCompetition {
  id: string
  uid: string
  date: string
  attendance?: number
  competitors: NFLCompetitor[]
  status: NFLStatus
  situation?: NFLSituation | null
  odds?: NFLOdds[]
  broadcasts?: Array<{
    market: string
    names: string[]
  }>
  venue?: {
    fullName: string
    address?: {
      city: string
      state: string
    }
  }
}

export interface NFLEvent {
  id: string
  uid: string
  date: string
  name: string
  shortName: string
  season?: {
    year: number
    type: number
    slug: string
  }
  week?: {
    number: number
  }
  competitions: NFLCompetition[]
  status: NFLStatus
  weather?: {
    displayValue?: string
    temperature?: number
    conditionId?: string
  }
}

export interface NFLCalendarEntry {
  label: string
  alternateLabel?: string
  detail?: string
  value: string
  startDate?: string
  endDate?: string
}

export interface NFLCalendarSection {
  label: string
  value: string
  startDate?: string
  endDate?: string
  entries?: NFLCalendarEntry[]
}

export interface NFLLeague {
  id: string
  name: string
  abbreviation: string
  calendar?: NFLCalendarSection[]
}

export interface NFLScoreboardData {
  leagues?: NFLLeague[]
  season?: {
    type: number
    year: number
  }
  week?: {
    number: number
  }
  events: NFLEvent[]
}

export interface NFLWeekSelection {
  seasonType: number // 1 = Preseason, 2 = Regular, 3 = Postseason (Playoffs)
  weekNumber: number
  year?: number
}

export type GameFilter = 'all' | 'live' | 'redzone' | 'halftime' | 'upcoming' | 'final'

