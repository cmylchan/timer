import type {
  CircuitBlock,
  IntervalTone,
  PhaseTone,
  TimedPhaseBlock,
  TimelineInterval,
  ValidationIssue,
  Workout,
  WorkoutBlock,
  WorkoutTimeline,
} from '../types/workout'
import { MAX_WEIGHT_LB } from './weights'

export const WORKOUT_LIMITS = {
  maxBlocks: 30,
  maxExercisesPerCircuit: 30,
  maxRounds: 20,
  maxIntervalSeconds: 60 * 60,
  maxTotalSeconds: 8 * 60 * 60,
  maxNameLength: 80,
} as const

export class WorkoutValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super('The workout is not valid.')
    this.name = 'WorkoutValidationError'
    this.issues = issues
  }
}

const TONE_LABELS: Record<IntervalTone, string> = {
  warmup: 'Warm-up',
  setup: 'Setup',
  cleanup: 'Cleanup',
  recovery: 'Recovery',
  custom: 'Timed block',
  work: 'Work',
  rest: 'Rest',
}

export function toneLabel(tone: IntervalTone) {
  return TONE_LABELS[tone]
}

/** The small label above a block's name: "Warm-up", "Circuit", ... */
export function blockKindLabel(block: WorkoutBlock) {
  return block.type === 'circuit' ? 'Circuit' : toneLabel(block.tone)
}

/**
 * How a block is named in lists of blocks. Timed blocks of a known kind
 * use the kind ("Setup"); generic timed blocks use their own name.
 */
export function blockListLabel(block: WorkoutBlock) {
  if (block.type === 'phase' && block.tone === 'custom') {
    return block.name.trim() || 'Timed block'
  }
  return blockKindLabel(block)
}

export function blockTone(block: WorkoutBlock): IntervalTone {
  return block.type === 'circuit' ? 'work' : block.tone
}

/** The four screen colors. Tones that share a color share a key. */
export type PhaseColor = 'char' | 'flash' | 'heat' | 'cobalt'

export function toneColor(tone: IntervalTone): PhaseColor {
  switch (tone) {
    case 'warmup':
      return 'char'
    case 'work':
      return 'heat'
    case 'rest':
    case 'recovery':
      return 'cobalt'
    default:
      return 'flash'
  }
}

function isPositiveInteger(value: number, maximum: number) {
  return Number.isInteger(value) && value > 0 && value <= maximum
}

function validateName(
  value: string,
  path: string,
  label: string,
  issues: ValidationIssue[],
) {
  if (!value.trim()) {
    issues.push({ path, message: `${label} is required.` })
  } else if (value.length > WORKOUT_LIMITS.maxNameLength) {
    issues.push({
      path,
      message: `${label} must be ${WORKOUT_LIMITS.maxNameLength} characters or fewer.`,
    })
  }
}

function validateCircuit(
  block: CircuitBlock,
  blockPath: string,
  issues: ValidationIssue[],
) {
  if (!isPositiveInteger(block.rounds, WORKOUT_LIMITS.maxRounds)) {
    issues.push({
      path: `${blockPath}.rounds`,
      message: `Rounds must be between 1 and ${WORKOUT_LIMITS.maxRounds}.`,
    })
  }

  for (const [field, label] of [
    ['workSeconds', 'Work'],
    ['restSeconds', 'Rest'],
  ] as const) {
    if (!isPositiveInteger(block[field], WORKOUT_LIMITS.maxIntervalSeconds)) {
      issues.push({
        path: `${blockPath}.${field}`,
        message: `${label} must be between 1 second and 60 minutes.`,
      })
    }
  }

  if (block.exercises.length === 0) {
    issues.push({
      path: `${blockPath}.exercises`,
      message: 'Add at least one exercise.',
    })
  } else if (block.exercises.length > WORKOUT_LIMITS.maxExercisesPerCircuit) {
    issues.push({
      path: `${blockPath}.exercises`,
      message: `A circuit can have at most ${WORKOUT_LIMITS.maxExercisesPerCircuit} exercises.`,
    })
  }

  block.exercises.forEach((exercise, exerciseIndex) => {
    const exercisePath = `${blockPath}.exercises.${exerciseIndex}`
    validateName(exercise.name, `${exercisePath}.name`, 'Exercise name', issues)
    exercise.weights.slice(0, block.rounds).forEach((weight, roundIndex) => {
      if (
        weight !== null &&
        !(Number.isFinite(weight) && weight > 0 && weight <= MAX_WEIGHT_LB)
      ) {
        issues.push({
          path: `${exercisePath}.weights.${roundIndex}`,
          message: `Weights must be between 0 and ${MAX_WEIGHT_LB} lb.`,
        })
      }
    })
  })
}

export function validateWorkout(workout: Workout): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  validateName(workout.name, 'name', 'Workout name', issues)

  if (workout.blocks.length === 0) {
    issues.push({ path: 'blocks', message: 'Add at least one block.' })
  } else if (workout.blocks.length > WORKOUT_LIMITS.maxBlocks) {
    issues.push({
      path: 'blocks',
      message: `A workout can have at most ${WORKOUT_LIMITS.maxBlocks} blocks.`,
    })
  }

  workout.blocks.forEach((block, blockIndex) => {
    const blockPath = `blocks.${blockIndex}`
    validateName(block.name, `${blockPath}.name`, 'Block name', issues)

    if (block.type === 'phase') {
      if (
        !isPositiveInteger(
          block.durationSeconds,
          WORKOUT_LIMITS.maxIntervalSeconds,
        )
      ) {
        issues.push({
          path: `${blockPath}.durationSeconds`,
          message: 'Duration must be between 1 second and 60 minutes.',
        })
      }
    } else {
      validateCircuit(block, blockPath, issues)
    }
  })

  if (issues.length === 0) {
    const totalSeconds = calculateWorkoutDuration(workout)
    if (totalSeconds > WORKOUT_LIMITS.maxTotalSeconds) {
      issues.push({
        path: 'blocks',
        message: 'A workout cannot be longer than 8 hours.',
      })
    }
  }

  return issues
}

export function calculateBlockDuration(block: WorkoutBlock) {
  if (block.type === 'phase') {
    return block.durationSeconds
  }

  return (
    block.rounds *
    block.exercises.length *
    (block.workSeconds + block.restSeconds)
  )
}

export function calculateWorkoutDuration(workout: Workout) {
  return workout.blocks.reduce(
    (total, block) => total + calculateBlockDuration(block),
    0,
  )
}

/** Each work interval of a circuit, in the order the circuit runs them. */
export function circuitSequence(block: CircuitBlock) {
  const steps: Array<{ roundIndex: number; exerciseIndex: number }> = []
  if (block.order === 'sets') {
    block.exercises.forEach((_, exerciseIndex) => {
      for (let roundIndex = 0; roundIndex < block.rounds; roundIndex += 1) {
        steps.push({ roundIndex, exerciseIndex })
      }
    })
  } else {
    for (let roundIndex = 0; roundIndex < block.rounds; roundIndex += 1) {
      block.exercises.forEach((_, exerciseIndex) => {
        steps.push({ roundIndex, exerciseIndex })
      })
    }
  }
  return steps
}

export function compileWorkout(workout: Workout): WorkoutTimeline {
  const issues = validateWorkout(workout)
  if (issues.length > 0) {
    throw new WorkoutValidationError(issues)
  }

  const intervals: TimelineInterval[] = []

  workout.blocks.forEach((block, blockIndex) => {
    if (block.type === 'phase') {
      intervals.push({
        id: block.id,
        blockId: block.id,
        blockIndex,
        kind: 'phase',
        tone: block.tone,
        label: block.name.trim(),
        durationSeconds: block.durationSeconds,
      })
      return
    }

    for (const { roundIndex, exerciseIndex } of circuitSequence(block)) {
      const exercise = block.exercises[exerciseIndex]
      const shared = {
        blockId: block.id,
        blockIndex,
        exerciseId: exercise.id,
        round: roundIndex + 1,
        totalRounds: block.rounds,
        exercise: exerciseIndex + 1,
        totalExercises: block.exercises.length,
        order: block.order,
      }
      const sequenceId = `${block.id}-${roundIndex}-${exerciseIndex}`
      intervals.push({
        ...shared,
        id: `${sequenceId}-work`,
        kind: 'work',
        tone: 'work',
        label: exercise.name.trim(),
        weight: exercise.weights[roundIndex] ?? null,
        durationSeconds: block.workSeconds,
      })
      intervals.push({
        ...shared,
        id: `${sequenceId}-rest`,
        kind: 'rest',
        tone: 'rest',
        label: 'Rest',
        durationSeconds: block.restSeconds,
      })
    }
  })

  const intervalStartSeconds: number[] = []
  let totalSeconds = 0
  intervals.forEach((interval) => {
    intervalStartSeconds.push(totalSeconds)
    totalSeconds += interval.durationSeconds
  })

  return { intervals, intervalStartSeconds, totalSeconds }
}

export function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.()
  return randomId
    ? `${prefix}-${randomId}`
    : `${prefix}-${Math.random().toString(36).slice(2)}`
}

export function createPhaseBlock(
  tone: PhaseTone = 'custom',
  name = 'New block',
  durationSeconds = 5 * 60,
): TimedPhaseBlock {
  return {
    id: createId('phase'),
    type: 'phase',
    name,
    durationSeconds,
    tone,
  }
}

export function createCircuitBlock(
  name = 'Circuit',
  exerciseNames = ['Exercise'],
): CircuitBlock {
  return {
    id: createId('circuit'),
    type: 'circuit',
    name,
    rounds: 3,
    workSeconds: 45,
    restSeconds: 15,
    order: 'circuit',
    exercises: exerciseNames.map((exerciseName) => ({
      id: createId('exercise'),
      name: exerciseName,
      weights: [null, null, null],
    })),
  }
}

/** A copy with fresh ids for the workout, its blocks, and exercises. */
export function cloneWorkout(
  workout: Workout,
  overrides: Partial<Pick<Workout, 'name' | 'days'>> = {},
): Workout {
  const copy = structuredClone(workout)
  return {
    ...copy,
    ...overrides,
    id: createId('workout'),
    createdAt: Date.now(),
    blocks: copy.blocks.map((block) =>
      block.type === 'phase'
        ? { ...block, id: createId('phase') }
        : {
            ...block,
            id: createId('circuit'),
            exercises: block.exercises.map((exercise) => ({
              ...exercise,
              id: createId('exercise'),
            })),
          },
    ),
  }
}

export function duplicateBlock(block: WorkoutBlock): WorkoutBlock {
  const copy = structuredClone(block)
  if (copy.type === 'phase') {
    return { ...copy, id: createId('phase') }
  }
  return {
    ...copy,
    id: createId('circuit'),
    exercises: copy.exercises.map((exercise) => ({
      ...exercise,
      id: createId('exercise'),
    })),
  }
}

export function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || to < 0 || to >= items.length) {
    return items
  }
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
