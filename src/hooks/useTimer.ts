import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
  createInitialPlaybackState,
  getIntervalStartMs,
  getPlaybackSnapshot,
  playbackReducer,
} from '../lib/timer'
import type { WorkoutTimeline } from '../types/workout'

const clock = () => performance.now()

export function useTimer(timeline: WorkoutTimeline) {
  const [state, dispatch] = useReducer(
    playbackReducer,
    undefined,
    createInitialPlaybackState,
  )
  const [nowMs, setNowMs] = useState(clock)

  useEffect(() => {
    if (state.status !== 'running') {
      return
    }
    const update = () => setNowMs(clock())
    update()
    const timerId = window.setInterval(update, 100)
    return () => window.clearInterval(timerId)
  }, [state.status])

  const snapshot = useMemo(
    () => getPlaybackSnapshot(timeline, state, nowMs),
    [nowMs, state, timeline],
  )

  useEffect(() => {
    if (state.status === 'running' && snapshot.isComplete) {
      dispatch({ type: 'complete', totalMs: snapshot.totalMs })
    }
  }, [snapshot.isComplete, snapshot.totalMs, state.status])

  const start = useCallback(() => {
    const now = clock()
    setNowMs(now)
    dispatch({ type: 'start', nowMs: now })
  }, [])

  const pause = useCallback(() => {
    const now = clock()
    setNowMs(now)
    dispatch({ type: 'pause', nowMs: now })
  }, [])

  const resume = useCallback(() => {
    const now = clock()
    setNowMs(now)
    dispatch({ type: 'resume', nowMs: now })
  }, [])

  const restart = useCallback(() => {
    const now = clock()
    setNowMs(now)
    dispatch({ type: 'restart', nowMs: now })
  }, [])

  const seekToIndex = useCallback(
    (index: number) => {
      const now = clock()
      setNowMs(now)
      dispatch({
        type: 'seek',
        nowMs: now,
        targetMs:
          index >= timeline.intervals.length
            ? timeline.totalSeconds * 1000
            : getIntervalStartMs(timeline, index),
        totalMs: timeline.totalSeconds * 1000,
      })
    },
    [timeline],
  )

  const next = useCallback(() => {
    seekToIndex(snapshot.intervalIndex + 1)
  }, [seekToIndex, snapshot.intervalIndex])

  const restartInterval = useCallback(() => {
    seekToIndex(snapshot.intervalIndex)
  }, [seekToIndex, snapshot.intervalIndex])

  const previous = useCallback(() => {
    seekToIndex(Math.max(0, snapshot.intervalIndex - 1))
  }, [seekToIndex, snapshot.intervalIndex])

  return {
    state,
    snapshot,
    start,
    pause,
    resume,
    restart,
    next,
    restartInterval,
    previous,
  }
}
