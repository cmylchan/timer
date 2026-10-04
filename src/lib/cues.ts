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

  private getContext() {
    const AudioContextConstructor =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!AudioContextConstructor) {
      throw new Error('Sound cues are not supported by this browser.')
    }
    this.context ??= new AudioContextConstructor()
    return this.context
  }

  /** Call from a click handler; browsers block sound until then. */
  async unlock() {
    const context = this.getContext()
    if (context.state === 'suspended') {
      await context.resume()
    }
  }

  /**
   * Plays now or not at all. A beep only means something the moment it's
   * due, so while sound is suspended it's dropped rather than held until
   * sound resumes, by which time the workout has moved on or stopped.
   */
  private async playNotes(notes: number[], duration = 0.11) {
    const context = this.getContext()
    if (context.state !== 'running') {
      await context.resume()
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

/**
 * Says callouts aloud. Skipping through intervals fires a burst of them,
 * and back-to-back speech calls can wedge Chromium's speech engine, even
 * across reloads. So a callout within CALLOUT_GAP_MS of the last waits
 * until they stop, and only the latest is said.
 */
export class Speaker {
  private lastCallAt = -Infinity
  private timerId: number | undefined
  /** The callout being said, or waiting for the engine to say it. */
  private current: SpeechSynthesisUtterance | null = null

  say(text: string) {
    const now = performance.now()
    const quiet = now - this.lastCallAt >= CALLOUT_GAP_MS
    this.lastCallAt = now
    window.clearTimeout(this.timerId)
    if (quiet) {
      this.speak(text)
    } else {
      this.timerId = window.setTimeout(() => this.speak(text), CALLOUT_GAP_MS)
    }
  }

  /** Cuts off the callout being said, and drops one waiting to be said. */
  stop() {
    window.clearTimeout(this.timerId)
    if (this.current && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.current = null
  }

  /** Cuts off a callout still being said, so stale ones never queue up. */
  private speak(text: string) {
    if (!('speechSynthesis' in window)) {
      return
    }
    const synth = window.speechSynthesis
    if (synth.speaking || synth.pending) {
      synth.cancel()
    }
    const utterance = new SpeechSynthesisUtterance(text)
    this.current = utterance
    // A stalled engine can start a callout after you've paused, skipped
    // or ended, when it no longer matches the screen. Cut it off.
    utterance.onstart = () => {
      if (!this.current) {
        synth.cancel()
      }
    }
    const finished = () => {
      if (this.current === utterance) {
        this.current = null
      }
    }
    utterance.onend = finished
    utterance.onerror = finished
    synth.speak(utterance)
  }
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}
