/**
 * Web Audio API synthesizer for broadcast-grade accessible audio cues.
 * Completely dependency-free, zero-network, and respects user mute preferences.
 * Hardened with master gain pooling, concurrent node bounding, and guaranteed cleanup.
 */

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let activeNodesCount = 0
const MAX_CONCURRENT_NODES = 8

function getAudioContext(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return null
      audioCtx = new AudioContextClass()
      masterGain = audioCtx.createGain()
      masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime)
      masterGain.connect(audioCtx.destination)
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    if (!masterGain) {
      masterGain = audioCtx.createGain()
      masterGain.connect(audioCtx.destination)
    }

    return { ctx: audioCtx, master: masterGain }
  } catch {
    return null
  }
}

function safeConnectAndCleanup(
  osc: OscillatorNode,
  gain: GainNode,
  master: GainNode,
  durationMs: number
): void {
  activeNodesCount++
  osc.connect(gain)
  gain.connect(master)

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    activeNodesCount = Math.max(0, activeNodesCount - 1)
    try {
      osc.disconnect()
    } catch {}
    try {
      gain.disconnect()
    } catch {}
  }

  osc.onended = cleanup
  // Backup timer in case onended is not fired (e.g. backgrounded tab or muted context)
  setTimeout(cleanup, durationMs + 100)
}

/**
 * Play an alert chime when a team enters the Red Zone (exciting D5 -> A5 double tone).
 */
export function playRedZoneSound(isMuted = false): void {
  if (isMuted || activeNodesCount >= MAX_CONCURRENT_NODES) return
  try {
    const audio = getAudioContext()
    if (!audio) return
    const { ctx, master } = audio

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // D5 (587Hz) to A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, now)
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12)

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    safeConnectAndCleanup(osc, gain, master, 350)

    osc.start(now)
    osc.stop(now + 0.35)
  } catch {
    // Gracefully handle browser autoplay policies
  }
}

/**
 * Play the iconic NFL Films orchestral brass fanfare chord (inspired by Sam Spence classic scores).
 * Synthesizes rich brass harmonics with low-pass filter decay.
 */
export function playNFLFilmsFanfare(isMuted = false): void {
  if (isMuted || activeNodesCount >= MAX_CONCURRENT_NODES) return
  try {
    const audio = getAudioContext()
    if (!audio) return
    const { ctx, master } = audio

    const now = ctx.currentTime
    // Orchestral Brass Triad: Bb3 (233Hz), F4 (349Hz), Bb4 (466Hz), D5 (587Hz)
    const brassNotes = [
      { freq: 233.08, delay: 0.0, dur: 0.6 },
      { freq: 349.23, delay: 0.04, dur: 0.65 },
      { freq: 466.16, delay: 0.08, dur: 0.7 },
      { freq: 587.33, delay: 0.12, dur: 0.75 },
    ]

    brassNotes.forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      osc.type = 'sawtooth' // Sawtooth wave gives authentic brass warmth
      osc.frequency.setValueAtTime(freq, now + delay)

      // Warm orchestral low-pass filter
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(freq * 1.5, now + delay)
      filter.frequency.exponentialRampToValueAtTime(freq * 4, now + delay + 0.1)
      filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + delay + dur)

      gain.gain.setValueAtTime(0.06, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.0005, now + delay + dur)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)

      safeConnectAndCleanup(osc, gain, master, Math.ceil((delay + dur) * 1000))

      osc.start(now + delay)
      osc.stop(now + delay + dur)
    })
  } catch {
    // Graceful fallback
  }
}

/**
 * Play a subtle major chord chime for score updates.
 */
export function playScoreChime(isMuted = false): void {
  // Use the NFL Films brass fanfare for authentic cinematic triumph
  playNFLFilmsFanfare(isMuted)
}

/**
 * Subtle tactile click for refresh or filter toggle.
 */
export function playTactileClick(isMuted = false): void {
  if (isMuted || activeNodesCount >= MAX_CONCURRENT_NODES) return
  try {
    const audio = getAudioContext()
    if (!audio) return
    const { ctx, master } = audio

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04)

    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    safeConnectAndCleanup(osc, gain, master, 150)

    osc.start(now)
    osc.stop(now + 0.04)
  } catch {
    // Graceful fallback
  }
}

