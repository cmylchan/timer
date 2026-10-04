import type { TimelineIntervalKind } from '../types/workout'

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

/** Countdown pitch by what comes next: high for work, low for rest. */
const COUNTDOWN_TONES: Record<TimelineIntervalKind | 'finish', number> = {
  work: 880,
  rest: 440,
  phase: 660,
  finish: 660,
}

export class CuePlayer {
  private context: AudioContext | null = null

  /** Call from a click handler; browsers block sound until then. */
  async unlock() {
    const AudioContextConstructor =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!AudioContextConstructor) {
      throw new Error('Sound cues are not supported by this browser.')
    }
    this.context ??= new AudioContextConstructor()
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  private async playNotes(notes: number[], duration = 0.11) {
    await this.unlock()
    const context = this.context
    if (!context) {
      return
    }

    const startAt = context.currentTime
    notes.forEach((frequency, index) => {
      const noteStart = startAt + index * (duration + 0.04)
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, noteStart)
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.2, noteStart + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + duration + 0.01)
    })
  }

  /** One of the three short beeps before a phase change. */
  playCountdown(upcoming: TimelineIntervalKind | 'finish') {
    return this.playNotes([COUNTDOWN_TONES[upcoming]], 0.09)
  }

  playComplete() {
    return this.playNotes([620, 760, 980], 0.16)
  }
}

export const cuePlayer = new CuePlayer()

/** Callouts closer together than this collapse into the last one. */
export const CALLOUT_GAP_MS = 500

/** Cuts off a callout still being said, so stale ones never queue up. */
function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    return
  }
  const synth = window.speechSynthesis
  if (synth.speaking || synth.pending) {
    synth.cancel()
  }
  synth.speak(new SpeechSynthesisUtterance(text))
}

/**
 * Says callouts aloud. Skipping through intervals fires a burst of them,
 * and back-to-back speech calls can wedge Chromium's speech engine, even
 * across reloads. So a callout within CALLOUT_GAP_MS of the last waits
 * until they stop, and only the latest is said.
 */
export class Speaker {
  private lastCallAt = -Infinity
  private timerId: number | undefined

  say(text: string) {
    const now = performance.now()
    const quiet = now - this.lastCallAt >= CALLOUT_GAP_MS
    this.lastCallAt = now
    window.clearTimeout(this.timerId)
    if (quiet) {
      speak(text)
    } else {
      this.timerId = window.setTimeout(() => speak(text), CALLOUT_GAP_MS)
    }
  }

  stop() {
    window.clearTimeout(this.timerId)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}
