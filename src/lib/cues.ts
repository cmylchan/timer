import type { TimelineIntervalKind } from '../types/workout'

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

export class CuePlayer {
  private context: AudioContext | null = null

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
      gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.01)
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        noteStart + duration,
      )
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + duration + 0.01)
    })
  }

  playCountdown() {
    return this.playNotes([740], 0.07)
  }

  playTransition(kind: TimelineIntervalKind) {
    if (kind === 'work') {
      return this.playNotes([620, 880])
    }
    if (kind === 'rest') {
      return this.playNotes([520])
    }
    return this.playNotes([540, 680])
  }

  playComplete() {
    return this.playNotes([620, 760, 980], 0.16)
  }

  async close() {
    if (this.context && this.context.state !== 'closed') {
      await this.context.close()
    }
    this.context = null
  }
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}
