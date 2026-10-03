import { useMemo, useState } from 'react'
import { formatLongDuration } from '../lib/format'
import {
  WORKOUT_LIMITS,
  calculateWorkoutDuration,
  createCircuitBlock,
  createId,
  createPhaseBlock,
  validateWorkout,
} from '../lib/workout'
import {
  PHASE_TONES,
  type CircuitBlock,
  type CircuitExercise,
  type TimedPhaseBlock,
  type ValidationIssue,
  type Workout,
  type WorkoutBlock,
} from '../types/workout'
import {
  ArrowLeftIcon,
  DownIcon,
  PlusIcon,
  TrashIcon,
  UpIcon,
} from './Icons'

interface WorkoutEditorProps {
  initialWorkout: Workout
  onCancel: () => void
  onSave: (workout: Workout) => string | null
}

function parseNumber(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function fieldError(issues: ValidationIssue[], path: string) {
  return issues.find((issue) => issue.path === path)?.message
}

interface FieldProps {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}

function Field({ label, error, children, className = '' }: FieldProps) {
  return (
    <label className={`field ${className}${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

interface BlockActionsProps {
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

function BlockActions({
  index,
  total,
  onMove,
  onRemove,
}: BlockActionsProps) {
  return (
    <div className="block-actions">
      <button
        className="icon-button"
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label="Move block up"
      >
        <UpIcon />
      </button>
      <button
        className="icon-button"
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === total - 1}
        aria-label="Move block down"
      >
        <DownIcon />
      </button>
      <button
        className="icon-button danger"
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Remove block"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

interface PhaseEditorProps {
  block: TimedPhaseBlock
  index: number
  issues: ValidationIssue[]
  onChange: (block: TimedPhaseBlock) => void
}

function PhaseEditor({
  block,
  index,
  issues,
  onChange,
}: PhaseEditorProps) {
  const basePath = `blocks.${index}`
  const minutes = Math.floor(block.durationSeconds / 60)
  const seconds = block.durationSeconds % 60

  return (
    <div className="editor-fields phase-fields">
      <Field
        label="Phase name"
        error={fieldError(issues, `${basePath}.name`)}
        className="field-wide"
      >
        <input
          value={block.name}
          maxLength={WORKOUT_LIMITS.maxNameLength}
          onChange={(event) =>
            onChange({ ...block, name: event.target.value })
          }
        />
      </Field>
      <Field
        label="Minutes"
        error={fieldError(issues, `${basePath}.durationSeconds`)}
      >
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="60"
          value={minutes}
          onChange={(event) =>
            onChange({
              ...block,
              durationSeconds:
                parseNumber(event.target.value) * 60 + seconds,
            })
          }
        />
      </Field>
      <Field label="Seconds">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          value={seconds}
          onChange={(event) =>
            onChange({
              ...block,
              durationSeconds:
                minutes * 60 +
                Math.min(59, parseNumber(event.target.value)),
            })
          }
        />
      </Field>
      <Field label="Color">
        <select
          value={block.tone}
          onChange={(event) =>
            onChange({
              ...block,
              tone: event.target.value as TimedPhaseBlock['tone'],
            })
          }
        >
          {PHASE_TONES.map((tone) => (
            <option value={tone} key={tone}>
              {tone.charAt(0).toUpperCase() + tone.slice(1)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}

interface ExerciseEditorProps {
  exercise: CircuitExercise
  exerciseIndex: number
  blockIndex: number
  rounds: number
  issues: ValidationIssue[]
  onChange: (exercise: CircuitExercise) => void
  onRemove: () => void
}

function ExerciseEditor({
  exercise,
  exerciseIndex,
  blockIndex,
  rounds,
  issues,
  onChange,
  onRemove,
}: ExerciseEditorProps) {
  const path = `blocks.${blockIndex}.exercises.${exerciseIndex}`
  const visibleRounds = Math.max(
    0,
    Math.min(rounds, WORKOUT_LIMITS.maxRounds),
  )

  const updateCue = (roundIndex: number, value: string) => {
    const nextCues = [...exercise.roundCues]
    while (nextCues.length <= roundIndex) {
      nextCues.push('')
    }
    nextCues[roundIndex] = value
    while (nextCues.at(-1) === '') {
      nextCues.pop()
    }
    onChange({ ...exercise, roundCues: nextCues })
  }

  return (
    <div className="exercise-editor">
      <div className="exercise-index" aria-hidden="true">
        {exerciseIndex + 1}
      </div>
      <div className="exercise-content">
        <Field
          label="Exercise"
          error={fieldError(issues, `${path}.name`)}
        >
          <input
            value={exercise.name}
            maxLength={WORKOUT_LIMITS.maxNameLength}
            onChange={(event) =>
              onChange({ ...exercise, name: event.target.value })
            }
          />
        </Field>
        <div className="cue-fields">
          {Array.from({ length: visibleRounds }, (_, roundIndex) => (
            <Field
              label={`Round ${roundIndex + 1} cue`}
              key={roundIndex}
              error={fieldError(
                issues,
                `${path}.roundCues.${roundIndex}`,
              )}
            >
              <input
                value={exercise.roundCues[roundIndex] ?? ''}
                maxLength={WORKOUT_LIMITS.maxCueLength}
                placeholder="Optional"
                onChange={(event) =>
                  updateCue(roundIndex, event.target.value)
                }
              />
            </Field>
          ))}
        </div>
      </div>
      <button
        className="icon-button danger exercise-remove"
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${exercise.name || 'exercise'}`}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

interface CircuitEditorProps {
  block: CircuitBlock
  index: number
  issues: ValidationIssue[]
  onChange: (block: CircuitBlock) => void
}

function CircuitEditor({
  block,
  index,
  issues,
  onChange,
}: CircuitEditorProps) {
  const basePath = `blocks.${index}`

  const updateExercise = (
    exerciseIndex: number,
    exercise: CircuitExercise,
  ) => {
    const exercises = [...block.exercises]
    exercises[exerciseIndex] = exercise
    onChange({ ...block, exercises })
  }

  const removeExercise = (exerciseIndex: number) => {
    onChange({
      ...block,
      exercises: block.exercises.filter(
        (_, currentIndex) => currentIndex !== exerciseIndex,
      ),
    })
  }

  return (
    <div className="circuit-editor">
      <div className="editor-fields circuit-fields">
        <Field
          label="Circuit name"
          error={fieldError(issues, `${basePath}.name`)}
          className="field-wide"
        >
          <input
            value={block.name}
            maxLength={WORKOUT_LIMITS.maxNameLength}
            onChange={(event) =>
              onChange({ ...block, name: event.target.value })
            }
          />
        </Field>
        <Field
          label="Rounds"
          error={fieldError(issues, `${basePath}.rounds`)}
        >
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={WORKOUT_LIMITS.maxRounds}
            value={block.rounds}
            onChange={(event) =>
              onChange({
                ...block,
                rounds: parseNumber(event.target.value),
                exercises: block.exercises.map((exercise) => ({
                  ...exercise,
                  roundCues: exercise.roundCues.slice(
                    0,
                    parseNumber(event.target.value),
                  ),
                })),
              })
            }
          />
        </Field>
        <Field
          label="Work seconds"
          error={fieldError(issues, `${basePath}.workSeconds`)}
        >
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={WORKOUT_LIMITS.maxIntervalSeconds}
            value={block.workSeconds}
            onChange={(event) =>
              onChange({
                ...block,
                workSeconds: parseNumber(event.target.value),
              })
            }
          />
        </Field>
        <Field
          label="Rest seconds"
          error={fieldError(issues, `${basePath}.restSeconds`)}
        >
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={WORKOUT_LIMITS.maxIntervalSeconds}
            value={block.restSeconds}
            onChange={(event) =>
              onChange({
                ...block,
                restSeconds: parseNumber(event.target.value),
              })
            }
          />
        </Field>
      </div>

      <div className="exercise-list">
        {block.exercises.map((exercise, exerciseIndex) => (
          <ExerciseEditor
            key={exercise.id}
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            blockIndex={index}
            rounds={block.rounds}
            issues={issues}
            onChange={(nextExercise) =>
              updateExercise(exerciseIndex, nextExercise)
            }
            onRemove={() => removeExercise(exerciseIndex)}
          />
        ))}
      </div>
      {fieldError(issues, `${basePath}.exercises`) && (
        <p className="field-error block-error">
          {fieldError(issues, `${basePath}.exercises`)}
        </p>
      )}
      <button
        className="button button-dashed"
        type="button"
        disabled={
          block.exercises.length >= WORKOUT_LIMITS.maxExercisesPerCircuit
        }
        onClick={() =>
          onChange({
            ...block,
            exercises: [
              ...block.exercises,
              {
                id: createId('exercise'),
                name: 'New exercise',
                roundCues: [],
              },
            ],
          })
        }
      >
        <PlusIcon />
        Add exercise
      </button>
    </div>
  )
}

export function WorkoutEditor({
  initialWorkout,
  onCancel,
  onSave,
}: WorkoutEditorProps) {
  const [draft, setDraft] = useState(initialWorkout)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const issues = useMemo(() => validateWorkout(draft), [draft])
  const duration =
    issues.length === 0 ? calculateWorkoutDuration(draft) : null

  const updateBlock = (index: number, block: WorkoutBlock) => {
    setDraft((current) => {
      const blocks = [...current.blocks]
      blocks[index] = block
      return { ...current, blocks }
    })
  }

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= draft.blocks.length) {
      return
    }
    setDraft((current) => {
      const blocks = [...current.blocks]
      const [block] = blocks.splice(from, 1)
      blocks.splice(to, 0, block)
      return { ...current, blocks }
    })
  }

  const removeBlock = (index: number) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    if (issues.length > 0) {
      setSubmitError('Fix the highlighted fields before creating the link.')
      return
    }
    const error = onSave(draft)
    setSubmitError(error)
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <button
          className="button button-quiet"
          type="button"
          onClick={onCancel}
        >
          <ArrowLeftIcon />
          Back
        </button>
        <div className="editor-title">
          <span className="eyebrow">Workout builder</span>
          <h1>Make every second yours.</h1>
          <p>
            Build a sequence, create its link, then bookmark it on any device.
          </p>
        </div>
        <div className="editor-total">
          <span>Total time</span>
          <strong>{duration === null ? '—' : formatLongDuration(duration)}</strong>
        </div>
      </header>

      <form className="editor-form" onSubmit={handleSubmit} noValidate>
        {(submitError || issues.length > 0) && (
          <div className="validation-banner" role="alert">
            <strong>
              {submitError ??
                `${issues.length} ${
                  issues.length === 1 ? 'field needs' : 'fields need'
                } attention.`}
            </strong>
            {issues.length > 0 && (
              <span>{issues[0].message}</span>
            )}
          </div>
        )}

        <section className="panel editor-name-panel">
          <Field
            label="Workout name"
            error={fieldError(issues, 'name')}
          >
            <input
              className="workout-name-input"
              value={draft.name}
              maxLength={WORKOUT_LIMITS.maxNameLength}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
        </section>

        <div className="block-list">
          {draft.blocks.map((block, index) => (
            <section className="panel block-editor" key={block.id}>
              <div className="block-header">
                <div>
                  <span className="block-number">
                    Block {index + 1}
                  </span>
                  <h2>
                    {block.type === 'phase' ? 'Timed phase' : 'Circuit'}
                  </h2>
                </div>
                <BlockActions
                  index={index}
                  total={draft.blocks.length}
                  onMove={moveBlock}
                  onRemove={removeBlock}
                />
              </div>
              {block.type === 'phase' ? (
                <PhaseEditor
                  block={block}
                  index={index}
                  issues={issues}
                  onChange={(nextBlock) => updateBlock(index, nextBlock)}
                />
              ) : (
                <CircuitEditor
                  block={block}
                  index={index}
                  issues={issues}
                  onChange={(nextBlock) => updateBlock(index, nextBlock)}
                />
              )}
            </section>
          ))}
        </div>

        {fieldError(issues, 'blocks') && (
          <p className="field-error block-error">
            {fieldError(issues, 'blocks')}
          </p>
        )}

        <div className="add-blocks">
          <button
            className="button button-dashed"
            type="button"
            disabled={draft.blocks.length >= WORKOUT_LIMITS.maxBlocks}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                blocks: [...current.blocks, createPhaseBlock()],
              }))
            }
          >
            <PlusIcon />
            Add timed phase
          </button>
          <button
            className="button button-dashed"
            type="button"
            disabled={draft.blocks.length >= WORKOUT_LIMITS.maxBlocks}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                blocks: [...current.blocks, createCircuitBlock()],
              }))
            }
          >
            <PlusIcon />
            Add circuit
          </button>
        </div>

        <footer className="editor-footer">
          <div>
            <strong>
              {duration === null
                ? 'Workout needs attention'
                : `${formatLongDuration(duration)} total`}
            </strong>
            <span>The generated link contains the complete workout.</span>
          </div>
          <div>
            <button
              className="button button-secondary button-large"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="button button-primary button-large"
              type="submit"
              disabled={issues.length > 0}
            >
              Create workout link
            </button>
          </div>
        </footer>
      </form>
    </main>
  )
}
