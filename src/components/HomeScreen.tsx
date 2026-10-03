import { useEffect, useMemo, useState } from 'react'
import { PRESET_WORKOUTS } from '../data/presets'
import { calculateWorkoutDuration } from '../lib/workout'
import type { PresetSlug, Weekday, Workout } from '../types/workout'
import { WEEKDAYS } from '../types/workout'
import { EditIcon, PlayIcon, PlusIcon } from './Icons'
import { WorkoutStrip } from './WorkoutStrip'

const RECENT_PRESETS: PresetSlug[] = ['friday', 'wednesday', 'tuesday']
const SHORT_DAY: Record<Weekday, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
}

const TODAY_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
}).format(new Date())

export interface NewWorkoutOptions {
  name: string
  scheduledDay?: Weekday
  source: 'standard' | 'copy' | 'blank'
  copySlug: PresetSlug
}

interface HomeScreenProps {
  selectedWorkout: Workout
  selectedSlug: PresetSlug | null
  hashError: string | null
  copied: boolean
  copyError: string | null
  onClearInvalidLink: () => void
  onStartWorkout: (slug: PresetSlug | null) => void
  onEditWorkout: (slug: PresetSlug | null) => void
  onCreate: (options: NewWorkoutOptions) => void
  onCopyLink: () => void
}

function getPreviousRunLabel(workout: Workout, today = new Date()) {
  if (!workout.scheduledDay) {
    return 'Custom workout'
  }

  const scheduledIndex = WEEKDAYS.indexOf(workout.scheduledDay)
  const daysAgo = (today.getDay() - scheduledIndex + 7) % 7 || 7
  if (daysAgo === 1) {
    return 'Yesterday'
  }

  const date = new Date(today)
  date.setDate(today.getDate() - daysAgo)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getNextScheduledLabel(today = new Date()) {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (today.getDay() + offset) % 7
    const slug = RECENT_PRESETS.find(
      (candidate) =>
        WEEKDAYS.indexOf(PRESET_WORKOUTS[candidate].scheduledDay!) === day,
    )
    if (slug) {
      return offset === 0
        ? `up today: ${PRESET_WORKOUTS[slug].name}`
        : `next scheduled: ${PRESET_WORKOUTS[slug].name}`
    }
  }
  return 'choose a workout'
}

function exerciseNames(workout: Workout) {
  const circuit = workout.blocks.find((block) => block.type === 'circuit')
  return circuit?.exercises.map((exercise) => exercise.name).join(' · ') ?? ''
}

function workoutMeta(workout: Workout, slug: PresetSlug | null) {
  const duration = Math.floor(calculateWorkoutDuration(workout) / 60)
  if (slug === 'tuesday') {
    return `${getPreviousRunLabel(workout)} · stopped at 31:40 of ${duration}:00`
  }
  if (slug === null) {
    return `${duration} min · custom workout`
  }
  return `${getPreviousRunLabel(workout)} · ${duration} min · completed`
}

interface WorkoutCardProps {
  workout: Workout
  slug: PresetSlug | null
  onStart: () => void
  onEdit: () => void
  onCopyLink?: () => void
  copied?: boolean
}

function WorkoutCard({
  workout,
  slug,
  onStart,
  onEdit,
  onCopyLink,
  copied,
}: WorkoutCardProps) {
  return (
    <article className="workout-card">
      <div className="workout-card-topline">
        <div>
          <div className="workout-card-title">
            <h2>{workout.name}</h2>
            {workout.scheduledDay && (
              <span className="day-chip">
                {SHORT_DAY[workout.scheduledDay]}
              </span>
            )}
          </div>
          <p className="workout-card-meta">{workoutMeta(workout, slug)}</p>
        </div>
        <div className="workout-card-actions">
          <button
            className="icon-button"
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${workout.name}`}
          >
            <EditIcon />
          </button>
          <button
            className="button button-dark"
            type="button"
            onClick={onStart}
            aria-label={`Start ${workout.name}`}
          >
            <PlayIcon />
            Start
          </button>
        </div>
      </div>
      <WorkoutStrip workout={workout} />
      <div className="workout-card-footer">
        <p>{exerciseNames(workout) || 'Add blocks in the workout editor'}</p>
        {onCopyLink && (
          <button className="text-button" type="button" onClick={onCopyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        )}
      </div>
    </article>
  )
}

interface NewWorkoutDialogProps {
  onClose: () => void
  onCreate: (options: NewWorkoutOptions) => void
}

function NewWorkoutDialog({ onClose, onCreate }: NewWorkoutDialogProps) {
  const [name, setName] = useState('Thursday legs')
  const [scheduledDay, setScheduledDay] = useState<Weekday | undefined>(
    'Thursday',
  )
  const [source, setSource] =
    useState<NewWorkoutOptions['source']>('standard')
  const [copySlug, setCopySlug] = useState<PresetSlug>('tuesday')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      return
    }
    onCreate({
      name: name.trim(),
      scheduledDay,
      source,
      copySlug,
    })
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form
        className="new-workout-dialog"
        aria-labelledby="new-workout-title"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-heading">
          <h2 id="new-workout-title">New workout</h2>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            aria-label="Close new workout dialog"
          >
            ×
          </button>
        </div>

        <label className="dialog-field">
          <span>Name</span>
          <input
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <fieldset className="day-picker-fieldset">
          <legend>Repeat on</legend>
          <div className="day-picker">
            {WEEKDAYS.slice(1).concat(WEEKDAYS[0]).map((day) => (
              <button
                className="day-button"
                data-selected={day === scheduledDay || undefined}
                type="button"
                key={day}
                onClick={() =>
                  setScheduledDay((current) =>
                    current === day ? undefined : day,
                  )
                }
                aria-pressed={day === scheduledDay}
                aria-label={day}
              >
                {day.charAt(0)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="source-fieldset">
          <legend>Start from</legend>
          <label className="source-option" data-selected={source === 'standard'}>
            <input
              type="radio"
              name="source"
              value="standard"
              checked={source === 'standard'}
              onChange={() => setSource('standard')}
            />
            <span>
              <strong>Standard template</strong>
              <small>
                Warm-up 25 · setup 5 · circuit 3 × 4 · cleanup 5
              </small>
              <WorkoutStrip workout={PRESET_WORKOUTS.tuesday} />
            </span>
          </label>
          <label className="source-option" data-selected={source === 'copy'}>
            <input
              type="radio"
              name="source"
              value="copy"
              checked={source === 'copy'}
              onChange={() => setSource('copy')}
            />
            <span>
              <strong>Copy an existing workout</strong>
              <select
                value={copySlug}
                onChange={(event) => {
                  setCopySlug(event.target.value as PresetSlug)
                  setSource('copy')
                }}
                aria-label="Workout to copy"
              >
                {RECENT_PRESETS.map((slug) => (
                  <option value={slug} key={slug}>
                    {PRESET_WORKOUTS[slug].name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="source-option" data-selected={source === 'blank'}>
            <input
              type="radio"
              name="source"
              value="blank"
              checked={source === 'blank'}
              onChange={() => setSource('blank')}
            />
            <span>
              <strong>Blank</strong>
              <small>Add blocks yourself</small>
            </span>
          </label>
        </fieldset>

        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-heat"
            type="submit"
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

export function HomeScreen({
  selectedWorkout,
  selectedSlug,
  hashError,
  copied,
  copyError,
  onClearInvalidLink,
  onStartWorkout,
  onEditWorkout,
  onCreate,
  onCopyLink,
}: HomeScreenProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const isCustom = selectedSlug === null && !hashError
  const nextScheduled = useMemo(() => getNextScheduledLabel(), [])

  return (
    <main className="home-shell">
      <header className="site-header">
        <div>
          <p className="home-kicker">
            {TODAY_LABEL} · {nextScheduled}
          </p>
          <h1>Your workouts</h1>
        </div>
        <button
          className="button button-heat"
          type="button"
          onClick={() => setDialogOpen(true)}
        >
          <PlusIcon />
          Create new workout
        </button>
      </header>

      {hashError && (
        <section className="link-error" role="alert">
          <div>
            <strong>That workout link could not be opened.</strong>
            <p>{hashError}</p>
          </div>
          <button
            className="button button-dark"
            type="button"
            onClick={onClearInvalidLink}
          >
            Open scheduled workout
          </button>
        </section>
      )}

      <section className="workout-list" aria-label="Recently run workouts">
        <p className="section-label">Recently run</p>
        {isCustom && (
          <WorkoutCard
            workout={selectedWorkout}
            slug={null}
            onStart={() => onStartWorkout(null)}
            onEdit={() => onEditWorkout(null)}
            onCopyLink={onCopyLink}
            copied={copied}
          />
        )}
        {RECENT_PRESETS.map((slug) => (
          <WorkoutCard
            workout={PRESET_WORKOUTS[slug]}
            slug={slug}
            key={slug}
            onStart={() => onStartWorkout(slug)}
            onEdit={() => onEditWorkout(slug)}
          />
        ))}
      </section>

      {copyError && (
        <p className="home-error" role="alert">
          {copyError}
        </p>
      )}

      <footer className="phase-legend">
        <span><i data-tone="warmup" />Warm-up</span>
        <span><i data-tone="setup" />Setup and cleanup</span>
        <span><i data-tone="work" />Work</span>
        <span><i data-tone="rest" />Rest</span>
      </footer>

      {dialogOpen && (
        <NewWorkoutDialog
          onClose={() => setDialogOpen(false)}
          onCreate={onCreate}
        />
      )}
    </main>
  )
}
