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
 * Play a subtle major chord chime for score updates.
 */
export function playScoreChime(isMuted = false): void {
  if (isMuted || activeNodesCount >= MAX_CONCURRENT_NODES) return
  try {
    const audio = getAudioContext()
    if (!audio) return
    const { ctx, master } = audio

    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    const now = ctx.currentTime

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.06)

      gain.gain.setValueAtTime(0.12, now + idx * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3)

      safeConnectAndCleanup(osc, gain, master, 500)

      osc.start(now + idx * 0.06)
      osc.stop(now + idx * 0.06 + 0.3)
    })
  } catch {
    // Graceful fallback
  }
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
