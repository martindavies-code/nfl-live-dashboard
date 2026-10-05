import type { NFLDrivePlay, PlayCategory } from '../types/nfl'

/**
 * Categorizes an NFL play into 'pass', 'run', 'sack', 'penalty', 'kick', or 'other'.
 */
export function categorizePlay(typeText: string = '', playText: string = ''): PlayCategory {
  const t = (typeText || '').toLowerCase()
  const p = (playText || '').toLowerCase()

  if (t.includes('sack') || p.includes('sacked')) {
    return 'sack'
  }
  if (t.includes('penalty') || p.includes('penalty') || p.includes('penalized')) {
    return 'penalty'
  }
  if (
    t.includes('pass') ||
    t.includes('reception') ||
    t.includes('incompletion') ||
    t.includes('intercept') ||
    p.includes(' pass ') ||
    p.includes('passed')
  ) {
    return 'pass'
  }
  if (
    t.includes('rush') ||
    t.includes('run') ||
    t.includes('scramble') ||
    p.includes(' rush ') ||
    p.includes(' ran ') ||
    p.includes('up the middle') ||
    p.includes('left tackle') ||
    p.includes('right tackle') ||
    p.includes('left end') ||
    p.includes('right end') ||
    p.includes('left guard') ||
    p.includes('right guard') ||
    p.includes('scrambles')
  ) {
    return 'run'
  }
  if (t.includes('punt') || t.includes('kick') || t.includes('field goal') || t.includes('extra point')) {
    return 'kick'
  }
  return 'other'
}

/**
 * Returns the theme color for a play category.
 * Pass = Electric Sky Blue (#38bdf8)
 * Run = Neon Rose (#f43f5e)
 * Sack = Violet (#a855f7)
 * Penalty = Amber (#f59e0b)
 * Other = Slate (#94a3b8)
 */
export function getPlayColor(category: PlayCategory): string {
  switch (category) {
    case 'pass':
      return '#38bdf8'
    case 'run':
      return '#f43f5e'
    case 'sack':
      return '#a855f7'
    case 'penalty':
      return '#f59e0b'
    default:
      return '#94a3b8'
  }
}

/**
 * Returns human-readable short label for the play category badge.
 */
export function getPlayCategoryLabel(category: PlayCategory): string {
  switch (category) {
    case 'pass':
      return 'Pass'
    case 'run':
      return 'Run'
    case 'sack':
      return 'Sack'
    case 'penalty':
      return 'Penalty'
    case 'kick':
      return 'Kick'
    default:
      return 'Play'
  }
}

/**
 * Detects whether a play is a kickoff or kickoff return.
 * Kickoffs initiate possession changes / halves and are never considered offensive plays of a drive.
 */
export function isKickoffPlay(play: any): boolean {
  if (!play) return false
  const typeText = typeof play.type?.text === 'string'
    ? play.type.text.toLowerCase()
    : typeof play.type === 'string'
    ? play.type.toLowerCase()
    : ''
  const playText = typeof play.text === 'string' ? play.text.toLowerCase() : ''
  const typeAbbr = typeof play.type?.abbreviation === 'string' ? play.type.abbreviation.toUpperCase() : ''
  const typeId = play.type?.id !== undefined && play.type?.id !== null ? String(play.type.id) : ''

  // Explicit kickoff type labels
  if (typeText.includes('kickoff') || typeText.includes('kick off') || typeText.includes('kick-off')) {
    return true
  }

  // Standard ESPN play type abbreviations & IDs for Kickoffs
  if (typeAbbr === 'KO' || typeAbbr === 'KR' || typeId === '52' || typeId === '53') {
    return true
  }

  // Kickoff play text phrasing
  if (/\b(kickoff|kick-off|kicks off|onside kick)\b/i.test(playText)) {
    return true
  }

  // e.g. "H.Butker kicks 65 yards from KC 35 to the end zone" or "kicks 65 yards from SF 35"
  if (/\bkicks?\s+\d+\s+yards?\s+from\b/i.test(playText)) {
    return true
  }

  // Non-offensive down with kicking action (excluding field goals, PATs, and punts)
  const down = play.start?.down ?? play.down
  const isSpecialTeamsDown = down === undefined || down === null || down <= 0
  if (
    isSpecialTeamsDown &&
    !typeText.includes('punt') &&
    !typeText.includes('field goal') &&
    !typeText.includes('extra point') &&
    !playText.includes('punts') &&
    !playText.includes('field goal') &&
    !playText.includes('extra point') &&
    (typeText.includes('kick') || /\bkicks?\b/i.test(playText))
  ) {
    return true
  }

  return false
}

/**
 * Parses raw play objects from ESPN summary API into strongly-typed NFLDrivePlay items.
 * Strictly excludes kickoffs from being included as the first play (or any play) of an offensive drive.
 */
export function parseRawESPNPlays(rawPlays: any[]): NFLDrivePlay[] {
  if (!Array.isArray(rawPlays)) return []

  // Filter out any timeouts, nulls, and kickoffs (kickoffs are not offensive drive plays)
  const offensivePlays = rawPlays.filter((p) => {
    if (!p) return false

    // Skip official timeouts or commercial breaks with zero spatial delta
    const typeText = p.type?.text || ''
    if (typeText.toLowerCase().includes('timeout') && !p.statYardage) {
      return false
    }

    // Never include kickoffs as a play in an offensive drive
    if (isKickoffPlay(p)) {
      return false
    }

    return true
  })

  const result: NFLDrivePlay[] = []

  offensivePlays.forEach((p, idx) => {
    const typeText = p.type?.text || ''
    const playText = p.text || ''
    const category = categorizePlay(typeText, playText)

    // ESPN provides start.yardLine and end.yardLine (0..100)
    let startYard = typeof p.start?.yardLine === 'number' && Number.isFinite(p.start.yardLine)
      ? p.start.yardLine
      : 50

    let endYard = typeof p.end?.yardLine === 'number' && Number.isFinite(p.end.yardLine)
      ? p.end.yardLine
      : startYard + (typeof p.statYardage === 'number' ? p.statYardage : 0)

    // Clamp coordinates to playing field (0 to 100)
    startYard = Math.max(0, Math.min(100, startYard))
    endYard = Math.max(0, Math.min(100, endYard))

    result.push({
      id: p.id ? String(p.id) : `play-${idx + 1}`,
      sequence: idx + 1,
      type: typeText || 'Play',
      category,
      text: playText,
      statYardage: typeof p.statYardage === 'number' ? p.statYardage : 0,
      startYardLine: startYard,
      endYardLine: endYard,
      down: p.start?.down,
      distance: p.start?.distance,
      clock: p.clock?.displayValue,
      scoringPlay: Boolean(p.scoringPlay),
    })
  })

  return result
}

/**
 * Calculates a vertical lane (Y coordinate) for a play in a drive to prevent visual overlap.
 * Staggers across 6 clean lanes between y=95 and y=305.
 */
export function getPlayLaneY(index: number, totalPlays: number): number {
  const lanes = [105, 145, 185, 225, 265, 305]
  if (totalPlays <= 6) {
    return lanes[index % lanes.length]
  }
  const baseLane = lanes[index % lanes.length]
  const subOffset = Math.floor(index / lanes.length) * 12
  return Math.min(320, Math.max(85, baseLane + (subOffset % 24)))
}

/**
 * Generate synthetic drive plays for simulation / offline demo scenarios.
 */
export function generateMockDrivePlays(
  currentYardLine: number = 55,
  direction: 'right' | 'left' = 'right',
  offenseAbbr: string = 'OFF'
): NFLDrivePlay[] {
  const isRight = direction === 'right'

  if (isRight) {
    // Sequential drive moving left to right ending at currentYardLine
    const y5 = Math.max(10, Math.min(98, currentYardLine))
    const y4 = Math.max(8, y5 - 8)
    const y3 = Math.max(6, y4 - 2)
    const y2 = Math.max(4, y3 - 16)
    const y1 = Math.max(2, y2 - 5)
    const y0 = Math.max(1, y1 - 4)

    return [
      {
        id: 'mock-p1',
        sequence: 1,
        type: 'Rush',
        category: 'run',
        text: `${offenseAbbr} rush up the middle for 4 yards.`,
        statYardage: y1 - y0,
        startYardLine: y0,
        endYardLine: y1,
        down: 1,
        distance: 10,
        clock: '9:45',
      },
      {
        id: 'mock-p2',
        sequence: 2,
        type: 'Rush',
        category: 'run',
        text: `${offenseAbbr} rush right tackle for 5 yards.`,
        statYardage: y2 - y1,
        startYardLine: y1,
        endYardLine: y2,
        down: 2,
        distance: 6,
        clock: '9:08',
      },
      {
        id: 'mock-p3',
        sequence: 3,
        type: 'Pass Reception',
        category: 'pass',
        text: `(Shotgun) ${offenseAbbr} pass deep middle for 16 yards. 1ST DOWN!`,
        statYardage: y3 - y2,
        startYardLine: y2,
        endYardLine: y3,
        down: 3,
        distance: 1,
        clock: '8:32',
      },
      {
        id: 'mock-p4',
        sequence: 4,
        type: 'Rush',
        category: 'run',
        text: `${offenseAbbr} rush left guard for 2 yards.`,
        statYardage: y4 - y3,
        startYardLine: y3,
        endYardLine: y4,
        down: 1,
        distance: 10,
        clock: '7:55',
      },
      {
        id: 'mock-p5',
        sequence: 5,
        type: 'Pass Reception',
        category: 'pass',
        text: `(Shotgun) ${offenseAbbr} pass short right for 8 yards to scrimmage.`,
        statYardage: y5 - y4,
        startYardLine: y4,
        endYardLine: y5,
        down: 2,
        distance: 8,
        clock: '7:20',
      },
    ]
  } else {
    // Sequential drive moving right to left ending at currentYardLine
    const y5 = Math.max(2, Math.min(90, currentYardLine))
    const y4 = Math.min(92, y5 + 8)
    const y3 = Math.min(94, y4 + 2)
    const y2 = Math.min(96, y3 + 16)
    const y1 = Math.min(98, y2 + 5)
    const y0 = Math.min(99, y1 + 4)

    return [
      {
        id: 'mock-p1',
        sequence: 1,
        type: 'Rush',
        category: 'run',
        text: `${offenseAbbr} rush left end for 4 yards.`,
        statYardage: y0 - y1,
        startYardLine: y0,
        endYardLine: y1,
        down: 1,
        distance: 10,
        clock: '9:45',
      },
      {
        id: 'mock-p2',
        sequence: 2,
        type: 'Rush',
        category: 'run',
        text: `${offenseAbbr} rush up the middle for 5 yards.`,
        statYardage: y1 - y2,
        startYardLine: y1,
        endYardLine: y2,
        down: 2,
        distance: 6,
        clock: '9:08',
      },
      {
        id: 'mock-p3',
        sequence: 3,
        type: 'Pass Reception',
        category: 'pass',
        text: `(Shotgun) ${offenseAbbr} pass deep left for 16 yards. 1ST DOWN!`,
        statYardage: y2 - y3,
        startYardLine: y2,
        endYardLine: y3,
        down: 3,
        distance: 1,
        clock: '8:32',
      },
      {
        id: 'mock-p4',
        sequence: 4,
        type: 'Rush',
        category: 'run',
        text: `${offenseAbbr} rush right tackle for 2 yards.`,
        statYardage: y3 - y4,
        startYardLine: y3,
        endYardLine: y4,
        down: 1,
        distance: 10,
        clock: '7:55',
      },
      {
        id: 'mock-p5',
        sequence: 5,
        type: 'Pass Reception',
        category: 'pass',
        text: `(Shotgun) ${offenseAbbr} pass short middle for 8 yards to scrimmage.`,
        statYardage: y4 - y5,
        startYardLine: y4,
        endYardLine: y5,
        down: 2,
        distance: 8,
        clock: '7:20',
      },
    ]
  }
}
