import type { WorkoutTimeline } from '../types/workout'

export type PlaybackStatus = 'ready' | 'running' | 'paused' | 'completed'

export interface PlaybackState {
  status: PlaybackStatus
  accumulatedMs: number
  runStartedAtMs: number | null
}

export type PlaybackAction =
  | { type: 'start'; nowMs: number }
  | { type: 'pause'; nowMs: number }
  | { type: 'resume'; nowMs: number }
  | { type: 'seek'; nowMs: number; targetMs: number; totalMs: number }
  | { type: 'restart'; nowMs: number }
  | { type: 'complete'; totalMs: number }
  | { type: 'reset' }

export interface PlaybackSnapshot {
  status: PlaybackStatus
  elapsedMs: number
  totalMs: number
  totalRemainingMs: number
  intervalIndex: number
  intervalElapsedMs: number
  intervalRemainingMs: number
  /** How far through the current interval, from 0 to 1. */
  intervalProgress: number
  isComplete: boolean
}

export function createInitialPlaybackState(): PlaybackState {
  return {
    status: 'ready',
    accumulatedMs: 0,
    runStartedAtMs: null,
  }
}

export function getElapsedMs(state: PlaybackState, nowMs: number) {
  if (state.status !== 'running' || state.runStartedAtMs === null) {
    return state.accumulatedMs
  }
  return state.accumulatedMs + Math.max(0, nowMs - state.runStartedAtMs)
}

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  switch (action.type) {
    case 'start':
      return {
        status: 'running',
        accumulatedMs: state.status === 'completed' ? 0 : state.accumulatedMs,
        runStartedAtMs: action.nowMs,
      }
    case 'pause':
      if (state.status !== 'running') {
        return state
      }
      return {
        status: 'paused',
        accumulatedMs: getElapsedMs(state, action.nowMs),
        runStartedAtMs: null,
      }
    case 'resume':
      if (state.status !== 'paused') {
        return state
      }
      return {
        ...state,
        status: 'running',
        runStartedAtMs: action.nowMs,
      }
    case 'seek': {
      const targetMs = Math.min(
        Math.max(0, action.targetMs),
        action.totalMs,
      )
      if (targetMs >= action.totalMs) {
        return {
          status: 'completed',
          accumulatedMs: action.totalMs,
          runStartedAtMs: null,
        }
      }
      const nextStatus =
        state.status === 'ready' && targetMs === 0 ? 'ready' : state.status
      return {
        status: nextStatus === 'completed' ? 'paused' : nextStatus,
        accumulatedMs: targetMs,
        runStartedAtMs:
          nextStatus === 'running' ? action.nowMs : null,
      }
    }
    case 'restart':
      return {
        status: 'running',
        accumulatedMs: 0,
        runStartedAtMs: action.nowMs,
      }
    case 'complete':
      return {
        status: 'completed',
        accumulatedMs: action.totalMs,
        runStartedAtMs: null,
      }
    case 'reset':
      return createInitialPlaybackState()
  }
}

function findIntervalIndex(timeline: WorkoutTimeline, elapsedMs: number) {
  const elapsedSeconds = elapsedMs / 1000
  let low = 0
  let high = timeline.intervalStartSeconds.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (timeline.intervalStartSeconds[middle] <= elapsedSeconds) {
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return Math.max(0, Math.min(high, timeline.intervals.length - 1))
}

export function getPlaybackSnapshot(
  timeline: WorkoutTimeline,
  state: PlaybackState,
  nowMs: number,
): PlaybackSnapshot {
  const totalMs = timeline.totalSeconds * 1000
  const elapsedMs = Math.min(getElapsedMs(state, nowMs), totalMs)
  const isComplete = elapsedMs >= totalMs
  const intervalIndex = isComplete
    ? timeline.intervals.length - 1
    : findIntervalIndex(timeline, elapsedMs)
  const intervalStartMs =
    timeline.intervalStartSeconds[intervalIndex] * 1000
  const intervalDurationMs =
    timeline.intervals[intervalIndex].durationSeconds * 1000
  const intervalElapsedMs = isComplete
    ? intervalDurationMs
    : Math.max(0, elapsedMs - intervalStartMs)

  return {
    status: isComplete ? 'completed' : state.status,
    elapsedMs,
    totalMs,
    totalRemainingMs: Math.max(0, totalMs - elapsedMs),
    intervalIndex,
    intervalElapsedMs,
    intervalRemainingMs: Math.max(
      0,
      intervalDurationMs - intervalElapsedMs,
    ),
    intervalProgress:
      intervalDurationMs === 0
        ? 1
        : Math.min(1, intervalElapsedMs / intervalDurationMs),
    isComplete,
  }
}

export function getIntervalStartMs(
  timeline: WorkoutTimeline,
  intervalIndex: number,
) {
  const safeIndex = Math.max(
    0,
    Math.min(intervalIndex, timeline.intervals.length - 1),
  )
  return timeline.intervalStartSeconds[safeIndex] * 1000
}
