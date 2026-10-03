import { PRESET_SLUGS, PRESET_WORKOUTS } from '../data/presets'
import { formatLongDuration } from '../lib/format'
import {
  calculateBlockDuration,
  calculateWorkoutDuration,
} from '../lib/workout'
import type { PresetSlug, Workout } from '../types/workout'
import { CopyIcon, EditIcon, PlayIcon, PlusIcon } from './Icons'

const TODAY_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
}).format(new Date())

interface HomeScreenProps {
  selectedWorkout: Workout
  selectedSlug: PresetSlug | null
  hashError: string | null
  copied: boolean
  copyError: string | null
  onClearInvalidLink: () => void
  onSelectPreset: (slug: PresetSlug) => void
  onStart: () => void
  onEdit: () => void
  onCreate: () => void
  onCopyLink: () => void
}

function WorkoutSummary({ workout }: { workout: Workout }) {
  return (
    <div className="workout-summary" aria-label="Workout structure">
      {workout.blocks.map((block, index) => (
        <article className="summary-block" key={block.id}>
          <div className="summary-marker" aria-hidden="true">
            {index + 1}
          </div>
          <div>
            <div className="summary-heading">
              <h3>{block.name}</h3>
              <span>{formatLongDuration(calculateBlockDuration(block))}</span>
            </div>
            {block.type === 'phase' ? (
              <p className="muted">Continuous phase</p>
            ) : (
              <>
                <p className="muted">
                  {block.rounds} rounds · {block.workSeconds}s work ·{' '}
                  {block.restSeconds}s rest
                </p>
                <div className="exercise-chips">
                  {block.exercises.map((exercise) => (
                    <span key={exercise.id}>
                      {exercise.name}
                      {exercise.roundCues.some(Boolean)
                        ? ` · ${exercise.roundCues
                            .filter(Boolean)
                            .join(' / ')}`
                        : ''}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>
      ))}
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
  onSelectPreset,
  onStart,
  onEdit,
  onCreate,
  onCopyLink,
}: HomeScreenProps) {
  const isCustom = selectedSlug === null && !hashError

  return (
    <main className="home-shell">
      <header className="site-header">
        <div className="brand" aria-label="HIIT Timer">
          <span className="brand-mark" aria-hidden="true">
            H
          </span>
          <span>HIIT Timer</span>
        </div>
        <button className="button button-quiet" type="button" onClick={onCreate}>
          <PlusIcon />
          Create workout
        </button>
      </header>

      {hashError && (
        <section className="link-error" role="alert">
          <div>
            <span className="eyebrow">Workout link error</span>
            <h2>That bookmark could not be opened.</h2>
            <p>{hashError}</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={onClearInvalidLink}
          >
            Open today&apos;s workout
          </button>
        </section>
      )}

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">
            {isCustom
              ? 'Custom workout'
              : `${selectedWorkout.scheduledDay ?? 'Today'} schedule`}
          </span>
          <p className="today-label">{TODAY_LABEL}</p>
          <h1>{selectedWorkout.name}</h1>
          <p className="hero-duration">
            {formatLongDuration(calculateWorkoutDuration(selectedWorkout))}
            <span aria-hidden="true"> / </span>
            {selectedWorkout.blocks.length} blocks
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary button-large"
              type="button"
              onClick={onStart}
            >
              <PlayIcon />
              Start workout
            </button>
            <button
              className="button button-secondary button-large"
              type="button"
              onClick={onEdit}
            >
              <EditIcon />
              {isCustom ? 'Edit workout' : 'Customize'}
            </button>
            {isCustom && (
              <button
                className="button button-quiet button-large"
                type="button"
                onClick={onCopyLink}
              >
                <CopyIcon />
                {copied ? 'Link copied' : 'Copy link'}
              </button>
            )}
          </div>
          {isCustom && (
            <p
              className={`bookmark-hint${copyError ? ' is-error' : ''}`}
              role={copyError ? 'alert' : undefined}
            >
              {copyError ??
                'This workout lives in the URL. Bookmark or copy this page to keep it.'}
            </p>
          )}
        </div>
        <div className="hero-time" aria-label="Total workout time">
          <strong>
            {Math.floor(calculateWorkoutDuration(selectedWorkout) / 60)}
          </strong>
          <span>minutes</span>
        </div>
      </section>

      <div className="home-grid">
        <section className="panel schedule-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Up next</span>
              <h2>Workout flow</h2>
            </div>
            <span className="section-stat">
              {selectedWorkout.blocks.length} blocks
            </span>
          </div>
          <WorkoutSummary workout={selectedWorkout} />
        </section>

        <aside className="panel preset-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Weekly set</span>
              <h2>Choose a day</h2>
            </div>
          </div>
          <div className="preset-list">
            {PRESET_SLUGS.map((slug) => {
              const workout = PRESET_WORKOUTS[slug]
              const selected = slug === selectedSlug
              return (
                <button
                  className={`preset-card${selected ? ' is-selected' : ''}`}
                  type="button"
                  key={slug}
                  onClick={() => onSelectPreset(slug)}
                  aria-pressed={selected}
                >
                  <span>
                    <small>{workout.scheduledDay}</small>
                    <strong>{workout.name.replace(/^\w+\s/u, '')}</strong>
                  </span>
                  <span className="preset-duration">
                    {Math.floor(calculateWorkoutDuration(workout) / 60)} min
                  </span>
                </button>
              )
            })}
          </div>
          <button
            className="create-card"
            type="button"
            onClick={onCreate}
          >
            <span className="create-icon">
              <PlusIcon />
            </span>
            <span>
              <strong>Build your own</strong>
              <small>Saved directly in its URL</small>
            </span>
          </button>
        </aside>
      </div>
    </main>
  )
}
