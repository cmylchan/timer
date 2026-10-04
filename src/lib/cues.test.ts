import { afterEach, describe, expect, it, vi } from 'vitest'
import { CuePlayer, Speaker } from './cues'

afterEach(() => vi.unstubAllGlobals())

/** Just enough of an AudioContext to see when each note starts. */
function stubAudio(state: AudioContextState) {
  const starts: number[] = []
  const param = {
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  }
  const context = {
    state,
    currentTime: 12,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: param,
      connect: () => {},
      start: (when: number) => starts.push(when),
      stop: () => {},
    }),
    createGain: () => ({ gain: param, connect: () => {} }),
  }
  vi.stubGlobal('AudioContext', function FakeAudioContext() {
    return context
  })
  return { context, starts }
}

interface StubUtterance {
  text: string
  onstart: (() => void) | null
}

/** Records callouts, which only start when a test says the engine did. */
function stubSpeech() {
  const utterances: StubUtterance[] = []
  const cancel = vi.fn()
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      onstart = null
      constructor(text: string) {
        this.text = text
      }
    },
  )
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    pending: false,
    speak: (utterance: StubUtterance) => utterances.push(utterance),
    cancel,
  })
  return { utterances, cancel }
}

describe('CuePlayer', () => {
  it('starts a beep the moment it is asked for', () => {
    const { starts } = stubAudio('running')

    void new CuePlayer().playCountdown('work')
    expect(starts).toEqual([12])
  })

  it('drops a beep while sound is suspended, rather than playing it late', async () => {
    const { context, starts } = stubAudio('suspended')
    const player = new CuePlayer()

    await player.playCountdown('work')
    expect(context.resume).toHaveBeenCalledOnce()
    expect(starts).toEqual([])

    await player.playCountdown('work')
    expect(starts).toEqual([12])
  })
})

describe('Speaker', () => {
  it('lets a callout play when the engine starts it', () => {
    const { utterances, cancel } = stubSpeech()

    new Speaker().say('Plank.')
    utterances[0].onstart?.()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('cuts off a callout the engine only starts after it was stopped', () => {
    const { utterances, cancel } = stubSpeech()
    const speaker = new Speaker()

    speaker.say('Rest. Next: plank.')
    speaker.stop()
    expect(cancel).toHaveBeenCalledOnce()

    // A stalled engine gets around to it anyway.
    utterances[0].onstart?.()
    expect(cancel).toHaveBeenCalledTimes(2)
  })
})
