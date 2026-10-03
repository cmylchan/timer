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
import { calculateBlockDuration, compileWorkout } from '../lib/workout'
import type {
  PhaseTone,
  TimelineInterval,
  Workout,
  WorkoutBlock,
} from '../types/workout'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
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

interface QueueItem {
  id: string
  label: string
  detail?: string
  durationSeconds: number
  tone: PhaseTone | 'work' | 'rest'
  active: boolean
}

const THEME_COLORS: Record<PhaseTone | 'work' | 'rest', string> = {
  warmup: '#1A0A05',
  setup: '#FFD23F',
  recovery: '#2337E8',
  cleanup: '#FFD23F',
  custom: '#FFD23F',
  work: '#FF4D2E',
  rest: '#2337E8',
}

function toneLabel(tone: PhaseTone | 'work' | 'rest') {
  const labels: Record<PhaseTone | 'work' | 'rest', string> = {
    warmup: 'Warm-up',
    setup: 'Setup',
    recovery: 'Recovery',
    cleanup: 'Cleanup',
    custom: 'Timed block',
    work: 'Work',
    rest: 'Rest',
  }
  return labels[tone]
}

function intervalMeta(interval: TimelineInterval, workout: Workout) {
  if (interval.kind === 'phase') {
    const blockIndex = workout.blocks.findIndex(
      (block) => block.id === interval.blockId,
    )
    return `${toneLabel(interval.tone)} · block ${blockIndex + 1} of ${workout.blocks.length}`
  }
  return `Round ${interval.round} of ${interval.totalRounds} · exercise ${interval.exercise} of ${interval.totalExercises}`
}

function isWeightCue(value?: string) {
  return Boolean(value && /^\d+(?:\.\d+)?\s*lb$/i.test(value.trim()))
}

function getEquipment(workout: Workout) {
  const weights = new Map<number, string>()
  let needsMat = false
  let needsJumpRope = false

  workout.blocks.forEach((block) => {
    if (block.type !== 'circuit') {
      return
    }
    block.exercises.forEach((exercise) => {
      if (/plank|v-sit/i.test(exercise.name)) {
        needsMat = true
      }
      if (/jump rope/i.test(exercise.name)) {
        needsJumpRope = true
      }
      exercise.roundCues.forEach((cue) => {
        if (!isWeightCue(cue)) {
          return
        }
        const value = Number.parseFloat(cue)
        if (Number.isFinite(value)) {
          weights.set(value, `${cue.trim()} dumbbells`)
        }
      })
    })
  })

  const equipment = [...weights.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, label]) => label)
  if (needsMat) {
    equipment.push('Mat')
  }
  if (needsJumpRope) {
    equipment.push('Jump rope')
  }
  return equipment
}

function getWeightChange(intervals: TimelineInterval[], index: number) {
  const current = intervals[index]
  const next = intervals[index + 1]
  if (current?.kind !== 'rest' || next?.kind !== 'work' || !isWeightCue(next.detail)) {
    return null
  }

  const previous = intervals
    .slice(0, index)
    .reverse()
    .find(
      (interval) =>
        interval.kind === 'work' && interval.label === next.label,
    )
  if (!previous || previous.detail === next.detail) {
    return null
  }
  return next.detail ?? null
}

function blockQueueItem(block: WorkoutBlock): QueueItem {
  return {
    id: block.id,
    label: block.type === 'circuit' ? 'Circuit' : toneLabel(block.tone),
    detail: block.name,
    durationSeconds: calculateBlockDuration(block),
    tone: block.type === 'circuit' ? 'work' : block.tone,
    active: false,
  }
}

function intervalQueueItem(
  interval: TimelineInterval,
  active: boolean,
): QueueItem {
  return {
    id: interval.id,
    label: interval.label,
    detail: interval.detail,
    durationSeconds: interval.durationSeconds,
    tone: interval.tone,
    active,
  }
}

function getQueueItems(
  workout: Workout,
  intervals: TimelineInterval[],
  index: number,
) {
  const current = intervals[index]
  if (current.kind === 'phase' && current.tone === 'warmup') {
    const blockIndex = workout.blocks.findIndex(
      (block) => block.id === current.blockId,
    )
    return workout.blocks.slice(blockIndex + 1).map(blockQueueItem)
  }

  const start = current.kind === 'phase' ? index + 1 : index
  return intervals
    .slice(start, start + 7)
    .map((interval, itemIndex) =>
      intervalQueueItem(interval, start === index && itemIndex === 0),
    )
}

function displayCountdown(interval: TimelineInterval, remainingMs: number) {
  const seconds = Math.ceil(remainingMs / 1000)
  return interval.kind === 'phase' ? formatDuration(seconds) : String(seconds)
}

function nextIntervalLabel(interval: TimelineInterval) {
  if (
    interval.detail &&
    /^side plank$/i.test(interval.label) &&
    /^(left|right)$/i.test(interval.detail)
  ) {
    return `${interval.detail} side plank`
  }
  return interval.detail
    ? `${interval.label} · ${interval.detail}`
    : interval.label
}

export function TimerScreen({ workout, onExit }: TimerScreenProps) {
  const timeline = useMemo(() => compileWorkout(workout), [workout])
  const timer = useTimer(timeline)
  const { snapshot, state } = timer
  const [cuesEnabled, setCuesEnabled] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [checkedEquipment, setCheckedEquipment] = useState<Set<string>>(
    () => new Set(),
  )
  const [capabilityMessage, setCapabilityMessage] = useState<string | null>(
    null,
  )
  const [wakeLockErrorDismissed, setWakeLockErrorDismissed] = useState(false)
  const [cuePlayer] = useState(() => new CuePlayer())
  const lastIntervalRef = useRef(snapshot.intervalIndex)
  const lastCountdownRef = useRef<number | null>(null)
  const lastSpokenRef = useRef<number | null>(null)
  const completionCuedRef = useRef(false)
  const current = timeline.intervals[snapshot.intervalIndex]
  const next = timeline.intervals[snapshot.intervalIndex + 1]
  const wakeLock = useWakeLock(state.status === 'running')
  const queueItems = useMemo(
    () => getQueueItems(workout, timeline.intervals, snapshot.intervalIndex),
    [snapshot.intervalIndex, timeline.intervals, workout],
  )
  const equipment = useMemo(() => getEquipment(workout), [workout])
  const weightChange = getWeightChange(
    timeline.intervals,
    snapshot.intervalIndex,
  )

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
    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )
    if (themeColor) {
      themeColor.content = THEME_COLORS[current.tone]
    }
    return () => {
      if (themeColor) {
        themeColor.content = '#F7F3EE'
      }
    }
  }, [current.tone])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
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
    if (
      state.status !== 'running' ||
      !cuesEnabled ||
      !weightChange ||
      lastSpokenRef.current === snapshot.intervalIndex ||
      !('speechSynthesis' in window)
    ) {
      return
    }
    lastSpokenRef.current = snapshot.intervalIndex
    const message = new SpeechSynthesisUtterance(`Grab ${weightChange}`)
    window.speechSynthesis.speak(message)
  }, [
    cuesEnabled,
    snapshot.intervalIndex,
    state.status,
    weightChange,
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
      void document.documentElement.requestFullscreen().catch(() => {
        setCapabilityMessage(
          'Full screen is unavailable. Signal will keep running in this window.',
        )
      })
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

  const handlePrimaryControl = useCallback(() => {
    if (state.status === 'running') {
      timer.pause()
    } else if (state.status === 'paused') {
      timer.resume()
    } else {
      handleStart()
    }
  }, [handleStart, state.status, timer])

  const handleRestart = useCallback(() => {
    completionCuedRef.current = false
    lastIntervalRef.current = 0
    lastCountdownRef.current = null
    lastSpokenRef.current = null
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
      if (endDialogOpen && event.key === 'Escape') {
        setEndDialogOpen(false)
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        handlePrimaryControl()
      } else if (event.key === 'ArrowRight') {
        timer.next()
      } else if (event.key === 'ArrowLeft') {
        timer.previous()
      } else if (event.key.toLowerCase() === 'm') {
        setCuesEnabled((enabled) => !enabled)
      } else if (event.key.toLowerCase() === 'f') {
        setFocusMode((focused) => !focused)
      } else if (event.key === 'Escape') {
        setEndDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [endDialogOpen, handlePrimaryControl, timer])

  if (snapshot.isComplete) {
    return (
      <main className="completion-screen">
        <div className="completion-mark" aria-hidden="true">
          <CheckIcon />
        </div>
        <p className="section-label">Workout complete</p>
        <h1>Strong finish.</h1>
        <p>
          You completed {workout.name} in{' '}
          {formatDuration(timeline.totalSeconds)}.
        </p>
        <div className="completion-actions">
          <button
            className="button button-heat"
            type="button"
            onClick={handleRestart}
          >
            <RestartIcon />
            Do it again
          </button>
          <button className="button button-dark" type="button" onClick={onExit}>
            Finish
          </button>
        </div>
      </main>
    )
  }

  const isRunning = state.status === 'running'
  const isReady = state.status === 'ready'
  const displayMessage =
    capabilityMessage ?? (wakeLockErrorDismissed ? null : wakeLock.error)
  const nextQueueItem = queueItems.find((item) => !item.active)
  const totalRemainingLabel = formatDuration(
    snapshot.totalRemainingMs / 1000,
  )
  const [remainingMinutes, remainingSeconds] =
    totalRemainingLabel.split(':')

  return (
    <main
      className={`timer-screen${focusMode ? ' is-focused' : ''}`}
      data-tone={current.tone}
    >
      <div className="timer-layout">
        <section className="timer-main">
          <header className="timer-meta">
            <span>{intervalMeta(current, workout)}</span>
            <span className="timer-title">{workout.name}</span>
          </header>

          <div className="timer-stage">
            <div
              className="countdown"
              aria-label={`${formatDuration(snapshot.intervalRemainingMs / 1000)} remaining in ${current.label}`}
            >
              {displayCountdown(current, snapshot.intervalRemainingMs)}
            </div>
            <div className="timer-copy">
              {current.kind !== 'rest' && (
                <p className="timer-phase-name">{toneLabel(current.tone)}</p>
              )}
              <h1>{current.label}</h1>
              {current.detail && (
                <p className="weight-badge">{current.detail}</p>
              )}
              {current.kind === 'rest' && next && (
                <p className="rest-next">
                  Next: {nextIntervalLabel(next)}
                </p>
              )}
            </div>
          </div>

          {current.kind === 'phase' &&
            current.tone === 'warmup' &&
            state.status !== 'ready' && (
              <p className="phase-guidance">
                Press → when you&apos;re back
              </p>
            )}

          {current.kind === 'phase' && current.tone === 'setup' && (
            <div className="equipment-checklist" aria-label="Equipment checklist">
              {equipment.map((item) => {
                const checked = checkedEquipment.has(item)
                return (
                  <button
                    type="button"
                    key={item}
                    data-checked={checked || undefined}
                    onClick={() =>
                      setCheckedEquipment((currentItems) => {
                        const nextItems = new Set(currentItems)
                        if (nextItems.has(item)) {
                          nextItems.delete(item)
                        } else {
                          nextItems.add(item)
                        }
                        return nextItems
                      })
                    }
                    aria-pressed={checked}
                  >
                    <span aria-hidden="true">{checked ? '✓' : ''}</span>
                    {item}
                  </button>
                )
              })}
            </div>
          )}

          {weightChange && (
            <div className="weight-change-callout">
              <ArrowRightIcon />
              <span>Grab {weightChange}</span>
            </div>
          )}

          <div className="mobile-next">
            <span>Up next</span>
            <strong>{nextQueueItem?.label ?? 'Finish'}</strong>
            {nextQueueItem?.detail && <small>{nextQueueItem.detail}</small>}
          </div>

          <div
            className="timer-progress"
            style={{ '--progress': snapshot.progress } as React.CSSProperties}
            aria-hidden="true"
          >
            <span />
          </div>

          <footer className="shortcut-bar">
            <button
              type="button"
              onClick={handlePrimaryControl}
              aria-label={
                isReady
                  ? 'Start'
                  : isRunning
                    ? 'Pause workout'
                    : 'Resume workout'
              }
            >
              <kbd>Space</kbd>
              {isReady ? (
                <PlayIcon />
              ) : isRunning ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
              {isReady ? 'Start' : isRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              onClick={timer.previous}
              aria-label="Previous interval"
            >
              <kbd>←</kbd>
              <ArrowLeftIcon />
              Restart
            </button>
            <button
              type="button"
              onClick={timer.next}
              aria-label="Next interval"
            >
              <kbd>→</kbd>
              <ArrowRightIcon />
              Skip
            </button>
            <button
              type="button"
              onClick={() => setFocusMode((focused) => !focused)}
              aria-pressed={focusMode}
            >
              <kbd>F</kbd>
              Focus
            </button>
            <button
              type="button"
              onClick={() => setCuesEnabled((enabled) => !enabled)}
              aria-label={cuesEnabled ? 'Turn cues off' : 'Turn cues on'}
              aria-pressed={cuesEnabled}
            >
              <kbd>M</kbd>
              {cuesEnabled ? <SoundIcon /> : <SoundOffIcon />}
              {cuesEnabled ? 'Mute' : 'Unmute'}
            </button>
            <button type="button" onClick={() => setEndDialogOpen(true)}>
              <kbd>Esc</kbd>
              End
            </button>
          </footer>
        </section>

        <aside className="queue-rail">
          <p className="queue-heading">Up next</p>
          <div className="queue-list">
            {queueItems.map((item) => (
              <div
                className="queue-item"
                data-active={item.active || undefined}
                key={item.id}
              >
                <span>
                  {!item.active && <i data-tone={item.tone} />}
                  <strong>{item.label}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </span>
                <span>
                  {item.detail && isWeightCue(item.detail)
                    ? item.detail
                    : formatDuration(item.durationSeconds)}
                </span>
              </div>
            ))}
          </div>
          <div className="queue-remaining">
            <span>Remaining</span>
            <strong aria-label={`${totalRemainingLabel} remaining`}>
              {remainingMinutes}<span aria-hidden="true">:</span>{remainingSeconds}
            </strong>
          </div>
        </aside>
      </div>

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

      {endDialogOpen && (
        <div className="end-dialog-backdrop">
          <div
            className="end-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-workout-title"
          >
            <p className="section-label">Workout in progress</p>
            <h2 id="end-workout-title">End this workout?</h2>
            <p>Your current progress will stop here.</p>
            <div>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setEndDialogOpen(false)}
              >
                Keep going
              </button>
              <button className="button button-dark" type="button" onClick={onExit}>
                End workout
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {current.label}
        {current.detail ? `, ${current.detail}` : ''}.{' '}
        {intervalMeta(current, workout)}.
      </p>
    </main>
  )
}
