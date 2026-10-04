import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useTimer } from '../hooks/useTimer'
import { useWakeLock } from '../hooks/useWakeLock'
import { PANEL_COLOR, useWindowChrome } from '../hooks/useWindowChrome'
import { cuePlayer, speak, vibrate } from '../lib/cues'
import { digitsWidthEm } from '../lib/digits'
import { formatDuration, toSentenceCase } from '../lib/format'
import { getQueue, getWeightChange, intervalRowLabel } from '../lib/queue'
import {
  equipmentChecklist,
  formatWeight,
  getEquipment,
} from '../lib/weights'
import {
  compileWorkout,
  toneLabel,
  toneColor,
  type PhaseColor,
} from '../lib/workout'
import type { TimelineInterval, Workout } from '../types/workout'
import { ConfirmDialog } from './ConfirmDialog'
import { Digits } from './Digits'
import { ArrowUpIcon, CheckIcon, CheckboxIcon, RestartIcon } from './Icons'

/** The rail shade of each phase color, which also tints the title bar. */
const RAIL_COLORS: Record<PhaseColor, string> = {
  char: '#2B1A14',
  flash: '#F2C12E',
  heat: '#E8432A',
  cobalt: '#1C2DC4',
}

/** Two presses of ← within this window go to the previous interval. */
const DOUBLE_PRESS_MS = 1500

interface TimerScreenProps {
  workout: Workout
  onProgress: (elapsedSeconds: number, completed: boolean) => void
  onExit: () => void
  onRestart: () => void
}

function intervalMeta(interval: TimelineInterval, blockCount: number) {
  if (interval.kind === 'phase') {
    const position = `block ${interval.blockIndex + 1} of ${blockCount}`
    return interval.tone === 'custom'
      ? `Block ${interval.blockIndex + 1} of ${blockCount}`
      : `${toneLabel(interval.tone)} · ${position}`
  }
  if (
    interval.kind === 'rest' &&
    interval.order !== 'sets' &&
    interval.exercise === interval.totalExercises
  ) {
    return `End of round ${interval.round}`
  }
  const unit = interval.order === 'sets' ? 'Set' : 'Round'
  return `${unit} ${interval.round} of ${interval.totalRounds} · exercise ${interval.exercise} of ${interval.totalExercises}`
}

/** Seconds alone for short intervals, minutes and seconds for blocks. */
function countdownText(interval: TimelineInterval, remainingMs: number) {
  const seconds = Math.ceil(remainingMs / 1000)
  return interval.kind !== 'phase' && interval.durationSeconds < 100
    ? String(seconds)
    : formatDuration(seconds)
}

export function TimerScreen({
  workout,
  onProgress,
  onExit,
  onRestart,
}: TimerScreenProps) {
  const timeline = useMemo(() => compileWorkout(workout), [workout])
  const timer = useTimer(timeline)
  const { snapshot, state, start } = timer
  const [cuesEnabled, setCuesEnabled] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set())
  const [cueError, setCueError] = useState<string | null>(null)
  const [wakeLockErrorDismissed, setWakeLockErrorDismissed] = useState(false)
  const lastBeepRef = useRef<string | null>(null)
  const lastSpokenRef = useRef<number | null>(null)
  const lastBackPressRef = useRef(0)
  const completionCuedRef = useRef(false)

  const index = snapshot.intervalIndex
  const current = timeline.intervals[index]
  const next = timeline.intervals[index + 1]
  const paused = state.status === 'paused'
  const running = state.status === 'running'
  const color = toneColor(current.tone)
  const wakeLock = useWakeLock(running)
  const queue = useMemo(
    () => getQueue(workout, timeline.intervals, index),
    [index, timeline.intervals, workout],
  )
  const checklist = useMemo(
    () => equipmentChecklist(getEquipment(workout)),
    [workout],
  )
  const weightChange = getWeightChange(timeline.intervals, index)
  const remainingWhole = Math.ceil(snapshot.intervalRemainingMs / 1000)
  const elapsedSeconds = Math.floor(snapshot.elapsedMs / 1000)

  useWindowChrome(
    `Signal · ${workout.name}`,
    snapshot.isComplete ? PANEL_COLOR : RAIL_COLORS[color],
  )

  useEffect(() => {
    start()
  }, [start])

  const reportCueError = useCallback((error: unknown) => {
    setCuesEnabled(false)
    setCueError(
      error instanceof Error ? error.message : 'Sound cues could not be played.',
    )
  }, [])

  const reportProgress = useEffectEvent(() => {
    onProgress(elapsedSeconds, snapshot.isComplete)
  })

  // Saved at every interval change and every 15 seconds, so a run that
  // ends by closing the window still has its elapsed time.
  const progressBucket = Math.floor(elapsedSeconds / 15)
  useEffect(() => {
    reportProgress()
  }, [index, progressBucket, state.status, snapshot.isComplete])

  useEffect(() => {
    const flush = () => reportProgress()
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        reportProgress()
      }
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  // Three short beeps before every phase change, pitched by what's next.
  useEffect(() => {
    if (remainingWhole > 3) {
      // Re-arm, so a restarted interval counts down out loud again.
      lastBeepRef.current = null
      return
    }
    if (!running || !cuesEnabled || remainingWhole < 1) {
      return
    }
    const key = `${index}:${remainingWhole}`
    if (lastBeepRef.current === key) {
      return
    }
    lastBeepRef.current = key
    void cuePlayer
      .playCountdown(next?.kind ?? 'finish')
      .catch(reportCueError)
    vibrate(60)
  }, [cuesEnabled, index, next?.kind, remainingWhole, reportCueError, running])

  useEffect(() => {
    if (
      !running ||
      !cuesEnabled ||
      weightChange === null ||
      lastSpokenRef.current === index
    ) {
      return
    }
    lastSpokenRef.current = index
    speak(`Grab ${weightChange} pounds`)
  }, [cuesEnabled, index, running, weightChange])

  useEffect(() => {
    if (!snapshot.isComplete || completionCuedRef.current) {
      return
    }
    completionCuedRef.current = true
    if (cuesEnabled) {
      void cuePlayer.playComplete().catch(reportCueError)
    }
  }, [cuesEnabled, reportCueError, snapshot.isComplete])

  const togglePause = useCallback(() => {
    if (state.status === 'running') {
      timer.pause()
    } else if (state.status === 'paused') {
      timer.resume()
    } else {
      timer.start()
    }
  }, [state.status, timer])

  const goBack = useCallback(() => {
    const now = Date.now()
    if (now - lastBackPressRef.current < DOUBLE_PRESS_MS) {
      timer.previous()
    } else {
      timer.restartInterval()
    }
    lastBackPressRef.current = now
  }, [timer])

  const toggleCues = useCallback(() => {
    setCueError(null)
    setCuesEnabled((enabled) => !enabled)
  }, [])

  const endWorkout = () => {
    onProgress(elapsedSeconds, false)
    onExit()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        endDialogOpen ||
        snapshot.isComplete ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        if (!event.repeat) {
          togglePause()
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        timer.next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
      } else if (event.key === 'f' || event.key === 'F') {
        if (!event.repeat) {
          setFocusMode((focused) => !focused)
        }
      } else if (event.key === 'm' || event.key === 'M') {
        if (!event.repeat) {
          toggleCues()
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setEndDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [endDialogOpen, goBack, snapshot.isComplete, timer, toggleCues, togglePause])

  if (snapshot.isComplete) {
    return (
      <main className="completion">
        <div className="completion-mark" aria-hidden="true">
          <CheckIcon />
        </div>
        <p className="meta">Workout complete</p>
        <h1>Strong finish.</h1>
        <p className="completion-summary">
          You completed {workout.name} in {formatDuration(timeline.totalSeconds)}.
        </p>
        <div className="completion-actions">
          <button className="button button-heat" type="button" onClick={onRestart}>
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

  const isPhase = current.kind === 'phase'
  const showChecklist =
    isPhase && current.tone === 'setup' && checklist.length > 0
  const text = countdownText(current, snapshot.intervalRemainingMs)
  const fullText = countdownText(current, current.durationSeconds * 1000)
  const remainingLabel = formatDuration(snapshot.totalRemainingMs / 1000)
  const notice =
    cueError ?? (wakeLockErrorDismissed ? null : wakeLock.error)

  return (
    <main
      className="timer"
      data-color={color}
      data-kind={current.kind}
      data-focus={focusMode || undefined}
      data-paused={paused || undefined}
    >
      <section className="timer-main">
        <header className="timer-meta">
          {paused && <span className="timer-paused">Paused</span>}
          <span>{intervalMeta(current, workout.blocks.length)}</span>
        </header>

        <div className="timer-stage">
          <div
            className="timer-group"
            data-layout={isPhase ? 'stack' : 'row'}
          >
            <div
              className="countdown"
              role="timer"
              style={{ '--countdown-em': digitsWidthEm(fullText) } as CSSProperties}
            >
              <span className="sr-only">{text}</span>
              <Digits text={text} />
            </div>

            <div className="timer-copy">
              {current.kind === 'work' && <p className="timer-phase">Work</p>}
              {current.kind === 'rest' ? (
                <h1 className="timer-phase">Rest</h1>
              ) : (
                <h1
                  className={showChecklist ? 'sr-only' : 'timer-name'}
                  data-long={current.label.length > 36 || undefined}
                >
                  {current.label}
                </h1>
              )}
              {current.kind === 'work' && current.weight != null && (
                <p className="weight-badge">{formatWeight(current.weight)}</p>
              )}
              {current.kind === 'rest' && next && (
                <p className="timer-next">
                  Next: {toSentenceCase(intervalRowLabel(next))}
                </p>
              )}
              {isPhase && current.tone === 'warmup' && (
                <p className="timer-hint">Press → when you&apos;re back</p>
              )}
              {showChecklist && (
                <ul className="checklist" aria-label="Equipment checklist">
                  {checklist.map((item) => {
                    const isChecked = checked.has(item)
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          aria-pressed={isChecked}
                          onClick={() =>
                            setChecked((items) => {
                              const nextItems = new Set(items)
                              if (!nextItems.delete(item)) {
                                nextItems.add(item)
                              }
                              return nextItems
                            })
                          }
                        >
                          <CheckboxIcon checked={isChecked} />
                          {item}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {current.kind !== 'rest' && (
                <p className="timer-upnext">
                  <span>Up next</span>{' '}
                  {queue.next
                    ? `${queue.next.label} · ${queue.next.value}`
                    : 'Finish'}
                </p>
              )}
            </div>
          </div>

          {weightChange !== null && (
            <div className="weight-callout">
              <ArrowUpIcon />
              <span>Grab {formatWeight(weightChange)}</span>
            </div>
          )}
        </div>

        <div className="timer-progress" aria-hidden="true">
          <span style={{ width: `${snapshot.intervalProgress * 100}%` }} />
        </div>

        <footer className="timer-hints">
          <button
            className="hint"
            type="button"
            onClick={togglePause}
            aria-label={paused ? 'Resume workout' : 'Pause workout'}
          >
            <kbd>Space</kbd>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <span className="hint">
            <span className="kbd kbd-pair">
              <button
                type="button"
                onClick={goBack}
                aria-label="Restart interval, press twice for the previous one"
              >
                ←
              </button>
              <button type="button" onClick={timer.next} aria-label="Next interval">
                →
              </button>
            </span>
            Skip
          </span>
          <button
            className="hint"
            type="button"
            onClick={() => setFocusMode((focused) => !focused)}
            aria-label="Focus mode"
            aria-pressed={focusMode}
          >
            <kbd>F</kbd>
            Focus
          </button>
          <button
            className="hint"
            type="button"
            onClick={toggleCues}
            aria-label="Mute cues"
            aria-pressed={!cuesEnabled}
          >
            <kbd>M</kbd>
            Mute
          </button>
          {paused && (
            <button
              className="hint"
              type="button"
              onClick={() => setEndDialogOpen(true)}
              aria-label="End workout"
            >
              <kbd>Esc</kbd>
              End
            </button>
          )}
        </footer>
      </section>

      <aside className="queue-rail" aria-label="Queue">
        <p className="rail-heading">Up next</p>
        <ol className="queue">
          {queue.rows.map((row) => (
            <li
              className="queue-row"
              data-highlighted={row.highlighted || undefined}
              key={row.key}
            >
              <span className="queue-label">
                {row.dot && <i className="dot" data-tone={row.tone} />}
                <span>{row.label}</span>
              </span>
              <span className="queue-value">{row.value}</span>
            </li>
          ))}
          {queue.rows.length === 0 && (
            <li className="queue-row">
              <span className="queue-label">Finish</span>
            </li>
          )}
        </ol>
        <div className="rail-remaining">
          <p>Remaining</p>
          <p className="rail-remaining-time">
            <span className="sr-only">{remainingLabel}</span>
            <Digits text={remainingLabel} />
          </p>
        </div>
      </aside>

      {notice && (
        <button
          className="timer-notice"
          type="button"
          onClick={() =>
            cueError ? setCueError(null) : setWakeLockErrorDismissed(true)
          }
        >
          {notice}
          <span>Dismiss</span>
        </button>
      )}

      {endDialogOpen && (
        <ConfirmDialog
          title="End this workout?"
          body={`It will be saved as stopped at ${formatDuration(
            elapsedSeconds,
          )} of ${formatDuration(timeline.totalSeconds)}.`}
          confirmLabel="End workout"
          cancelLabel="Keep going"
          onConfirm={endWorkout}
          onCancel={() => setEndDialogOpen(false)}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {current.kind === 'rest' ? 'Rest' : current.label}
        {current.weight != null ? `, ${formatWeight(current.weight)}` : ''}.{' '}
        {intervalMeta(current, workout.blocks.length)}.
      </p>
    </main>
  )
}
