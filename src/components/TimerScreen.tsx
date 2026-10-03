import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTimer } from '../hooks/useTimer'
import { useWakeLock } from '../hooks/useWakeLock'
import { CuePlayer, vibrate } from '../lib/cues'
import { formatDuration } from '../lib/format'
import { compileWorkout } from '../lib/workout'
import type { TimelineInterval, Workout } from '../types/workout'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExpandIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
  SoundIcon,
  SoundOffIcon,
} from './Icons'

interface TimerScreenProps {
  workout: Workout
  onExit: () => void
}

function fullscreenError(error: unknown) {
  return error instanceof Error
    ? `Full screen unavailable: ${error.message}`
    : 'Full screen is unavailable.'
}

function intervalMeta(interval: TimelineInterval) {
  if (interval.kind === 'phase') {
    return 'Continuous phase'
  }
  return `Round ${interval.round} of ${interval.totalRounds} · Exercise ${interval.exercise} of ${interval.totalExercises}`
}

export function TimerScreen({ workout, onExit }: TimerScreenProps) {
  const timeline = useMemo(() => compileWorkout(workout), [workout])
  const timer = useTimer(timeline)
  const { snapshot, state } = timer
  const [cuesEnabled, setCuesEnabled] = useState(true)
  const [capabilityMessage, setCapabilityMessage] = useState<string | null>(
    null,
  )
  const [wakeLockErrorDismissed, setWakeLockErrorDismissed] =
    useState(false)
  const [cuePlayer] = useState(() => new CuePlayer())
  const lastIntervalRef = useRef(snapshot.intervalIndex)
  const lastCountdownRef = useRef<number | null>(null)
  const completionCuedRef = useRef(false)
  const current = timeline.intervals[snapshot.intervalIndex]
  const next = timeline.intervals[snapshot.intervalIndex + 1]
  const wakeLock = useWakeLock(state.status === 'running')

  const reportCueError = useCallback((error: unknown) => {
    setCuesEnabled(false)
    setCapabilityMessage(
      error instanceof Error
        ? error.message
        : 'Sound cues could not be played.',
    )
  }, [])

  const playCue = useCallback(
    (cue: Promise<void>) => {
      void cue.catch(reportCueError)
    },
    [reportCueError],
  )

  useEffect(() => {
    return () => {
      void cuePlayer.close().catch((error: unknown) => {
        console.error('Could not close the audio context.', error)
      })
    }
  }, [cuePlayer])

  useEffect(() => {
    if (
      state.status === 'running' &&
      lastIntervalRef.current !== snapshot.intervalIndex
    ) {
      lastIntervalRef.current = snapshot.intervalIndex
      lastCountdownRef.current = null
      if (cuesEnabled) {
        playCue(cuePlayer.playTransition(current.kind))
        vibrate(current.kind === 'work' ? [100, 60, 100] : 100)
      }
    }
  }, [
    cuesEnabled,
    cuePlayer,
    current.kind,
    playCue,
    snapshot.intervalIndex,
    state.status,
  ])

  useEffect(() => {
    if (state.status !== 'running' || !cuesEnabled) {
      return
    }
    const remainingSeconds = Math.ceil(snapshot.intervalRemainingMs / 1000)
    if (
      remainingSeconds > 0 &&
      remainingSeconds <= 3 &&
      remainingSeconds !== lastCountdownRef.current
    ) {
      lastCountdownRef.current = remainingSeconds
      playCue(cuePlayer.playCountdown())
    } else if (remainingSeconds > 3) {
      lastCountdownRef.current = null
    }
  }, [
    cuesEnabled,
    cuePlayer,
    playCue,
    snapshot.intervalRemainingMs,
    state.status,
  ])

  useEffect(() => {
    if (snapshot.isComplete && !completionCuedRef.current) {
      completionCuedRef.current = true
      if (cuesEnabled) {
        playCue(cuePlayer.playComplete())
        vibrate([150, 80, 150, 80, 250])
      }
    }
  }, [cuePlayer, cuesEnabled, playCue, snapshot.isComplete])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      if (!document.exitFullscreen) {
        setCapabilityMessage('Leaving full screen is not supported here.')
        return
      }
      void document
        .exitFullscreen()
        .catch((error: unknown) =>
          setCapabilityMessage(fullscreenError(error)),
        )
      return
    }
    if (!document.documentElement.requestFullscreen) {
      setCapabilityMessage('Full screen is not supported by this browser.')
      return
    }
    void document.documentElement
      .requestFullscreen()
      .catch((error: unknown) =>
        setCapabilityMessage(fullscreenError(error)),
      )
  }, [])

  const handleStart = useCallback(() => {
    setCapabilityMessage(null)
    completionCuedRef.current = false
    lastIntervalRef.current = snapshot.intervalIndex
    if (cuesEnabled) {
      playCue(cuePlayer.playTransition(current.kind))
      vibrate(current.kind === 'work' ? [100, 60, 100] : 100)
    }
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      void document.documentElement
        .requestFullscreen()
        .catch((error: unknown) =>
          setCapabilityMessage(fullscreenError(error)),
        )
    }
    timer.start()
  }, [
    cuesEnabled,
    cuePlayer,
    current.kind,
    playCue,
    snapshot.intervalIndex,
    timer,
  ])

  const handleRestart = useCallback(() => {
    completionCuedRef.current = false
    lastIntervalRef.current = 0
    lastCountdownRef.current = null
    timer.restart()
  }, [timer])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (state.status === 'running') {
          timer.pause()
        } else if (state.status === 'paused') {
          timer.resume()
        } else if (state.status === 'ready') {
          handleStart()
        }
      } else if (event.key === 'ArrowRight') {
        timer.next()
      } else if (event.key === 'ArrowLeft') {
        timer.previous()
      } else if (event.key.toLowerCase() === 'm') {
        setCuesEnabled((enabled) => !enabled)
      } else if (event.key.toLowerCase() === 'f') {
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleStart, state.status, timer, toggleFullscreen])

  if (snapshot.isComplete) {
    return (
      <main className="completion-screen">
        <div className="completion-orbit" aria-hidden="true">
          <CheckIcon />
        </div>
        <span className="eyebrow">Workout complete</span>
        <h1>Strong finish.</h1>
        <p>
          You completed {workout.name} in{' '}
          {formatDuration(timeline.totalSeconds)}.
        </p>
        <div className="completion-actions">
          <button
            className="button button-primary button-large"
            type="button"
            onClick={handleRestart}
          >
            <RestartIcon />
            Do it again
          </button>
          <button
            className="button button-secondary button-large"
            type="button"
            onClick={onExit}
          >
            Finish
          </button>
        </div>
      </main>
    )
  }

  const isRunning = state.status === 'running'
  const isReady = state.status === 'ready'
  const phaseTone = current.tone
  const displayMessage =
    capabilityMessage ??
    (wakeLockErrorDismissed ? null : wakeLock.error)

  return (
    <main className="timer-screen" data-tone={phaseTone}>
      <div
        className="timer-progress"
        style={{ '--progress': snapshot.progress } as React.CSSProperties}
        aria-hidden="true"
      />
      <header className="timer-header">
        <button
          className="timer-text-button"
          type="button"
          onClick={onExit}
        >
          <ArrowLeftIcon />
          Exit
        </button>
        <div className="timer-workout-name">
          <span>{workout.name}</span>
          <small>
            {formatDuration(snapshot.totalRemainingMs / 1000)} remaining
          </small>
        </div>
        <div className="timer-utilities">
          <button
            className="timer-icon-button"
            type="button"
            onClick={() => setCuesEnabled((enabled) => !enabled)}
            aria-label={cuesEnabled ? 'Turn cues off' : 'Turn cues on'}
            aria-pressed={cuesEnabled}
          >
            {cuesEnabled ? <SoundIcon /> : <SoundOffIcon />}
          </button>
          <button
            className="timer-icon-button"
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle full screen"
          >
            <ExpandIcon />
          </button>
        </div>
      </header>

      <section className="timer-stage">
        <div className="timer-context">
          <span className="timer-kind">
            {current.kind === 'work'
              ? 'Work'
              : current.kind === 'rest'
                ? 'Recover'
                : 'Phase'}
          </span>
          <span>{intervalMeta(current)}</span>
        </div>
        <div className="timer-label">
          <h1>{current.label}</h1>
          {current.detail && <p>{current.detail}</p>}
        </div>
        <div
          className="countdown"
          aria-label={`${formatDuration(snapshot.intervalRemainingMs / 1000)} remaining in ${current.label}`}
        >
          {formatDuration(snapshot.intervalRemainingMs / 1000)}
        </div>
        <div className="next-interval">
          <span>Next</span>
          <strong>{next?.label ?? 'Finish'}</strong>
          {next?.detail && <small>{next.detail}</small>}
        </div>
      </section>

      <footer className="timer-footer">
        <button
          className="timer-control secondary"
          type="button"
          onClick={timer.previous}
          aria-label="Previous interval"
        >
          <ArrowLeftIcon />
        </button>
        {isReady ? (
          <button
            className="timer-control primary start-control"
            type="button"
            onClick={handleStart}
          >
            <PlayIcon />
            Start
          </button>
        ) : (
          <button
            className="timer-control primary"
            type="button"
            onClick={isRunning ? timer.pause : timer.resume}
            aria-label={isRunning ? 'Pause workout' : 'Resume workout'}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
        <button
          className="timer-control secondary"
          type="button"
          onClick={timer.next}
          aria-label="Next interval"
        >
          <ArrowRightIcon />
        </button>
      </footer>

      {state.status === 'paused' && (
        <div className="paused-badge" role="status">
          Paused
        </div>
      )}
      {displayMessage && (
        <button
          className="capability-message"
          type="button"
          onClick={() => {
            if (capabilityMessage) {
              setCapabilityMessage(null)
            } else {
              setWakeLockErrorDismissed(true)
            }
          }}
        >
          {displayMessage}
          <span>Dismiss</span>
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {current.label}
        {current.detail ? `, ${current.detail}` : ''}. {intervalMeta(current)}.
      </p>
    </main>
  )
}
