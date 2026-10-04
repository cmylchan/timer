import { describe, expect, it } from 'vitest'
import type { WorkoutTimeline } from '../types/workout'
import {
  createInitialPlaybackState,
  getPlaybackSnapshot,
  playbackReducer,
} from './timer'

const timeline: WorkoutTimeline = {
  intervals: [
    {
      id: 'one',
      blockId: 'circuit',
      blockIndex: 0,
      kind: 'work',
      tone: 'work',
      label: 'One',
      durationSeconds: 45,
    },
    {
      id: 'rest',
      blockId: 'circuit',
      blockIndex: 0,
      kind: 'rest',
      tone: 'rest',
      label: 'Rest',
      durationSeconds: 15,
    },
    {
      id: 'two',
      blockId: 'circuit',
      blockIndex: 0,
      kind: 'work',
      tone: 'work',
      label: 'Two',
      durationSeconds: 45,
    },
  ],
  intervalStartSeconds: [0, 45, 60],
  totalSeconds: 105,
}

describe('timer playback', () => {
  it('derives elapsed time from timestamps without tick drift', () => {
    const running = playbackReducer(createInitialPlaybackState(), {
      type: 'start',
      nowMs: 1_000,
    })

    const snapshot = getPlaybackSnapshot(timeline, running, 12_234)

    expect(snapshot.elapsedMs).toBe(11_234)
    expect(snapshot.intervalIndex).toBe(0)
    expect(snapshot.intervalRemainingMs).toBe(33_766)
  })

  it('freezes paused time and resumes from the accumulated duration', () => {
    const started = playbackReducer(createInitialPlaybackState(), {
      type: 'start',
      nowMs: 1_000,
    })
    const paused = playbackReducer(started, {
      type: 'pause',
      nowMs: 11_000,
    })
    const resumed = playbackReducer(paused, {
      type: 'resume',
      nowMs: 51_000,
    })

    expect(getPlaybackSnapshot(timeline, paused, 50_000).elapsedMs).toBe(
      10_000,
    )
    expect(getPlaybackSnapshot(timeline, resumed, 56_000).elapsedMs).toBe(
      15_000,
    )
  })

  it('catches up across multiple interval boundaries', () => {
    const running = playbackReducer(createInitialPlaybackState(), {
      type: 'start',
      nowMs: 0,
    })

    const snapshot = getPlaybackSnapshot(timeline, running, 62_500)

    expect(snapshot.intervalIndex).toBe(2)
    expect(snapshot.intervalElapsedMs).toBe(2_500)
    expect(snapshot.intervalRemainingMs).toBe(42_500)
  })

  it('selects the next interval exactly at a boundary', () => {
    const running = playbackReducer(createInitialPlaybackState(), {
      type: 'start',
      nowMs: 0,
    })

    expect(getPlaybackSnapshot(timeline, running, 45_000)).toMatchObject({
      intervalIndex: 1,
      intervalElapsedMs: 0,
      intervalRemainingMs: 15_000,
    })
  })

  it('reports progress through the current interval only', () => {
    const running = playbackReducer(createInitialPlaybackState(), {
      type: 'start',
      nowMs: 0,
    })

    expect(getPlaybackSnapshot(timeline, running, 9_000).intervalProgress).toBe(0.2)
    expect(getPlaybackSnapshot(timeline, running, 48_000).intervalProgress).toBe(0.2)
  })

  it('clamps a seek at completion', () => {
    const completed = playbackReducer(createInitialPlaybackState(), {
      type: 'seek',
      nowMs: 10,
      targetMs: 999_999,
      totalMs: 105_000,
    })

    expect(completed).toEqual({
      status: 'completed',
      accumulatedMs: 105_000,
      runStartedAtMs: null,
    })
  })
})
