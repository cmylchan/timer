import type {
  CircuitBlock,
  PhaseTone,
  TimelineInterval,
  ValidationIssue,
  Workout,
  WorkoutBlock,
  WorkoutTimeline,
} from '../types/workout'

export const WORKOUT_LIMITS = {
  maxBlocks: 30,
  maxExercisesPerCircuit: 30,
  maxRounds: 50,
  maxIntervalSeconds: 60 * 60,
  maxTotalSeconds: 8 * 60 * 60,
  maxNameLength: 80,
  maxCueLength: 80,
} as const

export class WorkoutValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super('The workout is not valid.')
    this.name = 'WorkoutValidationError'
    this.issues = issues
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
  maximum = WORKOUT_LIMITS.maxNameLength,
) {
  if (!value.trim()) {
    issues.push({ path, message: `${label} is required.` })
  } else if (value.length > maximum) {
    issues.push({
      path,
      message: `${label} must be ${maximum} characters or fewer.`,
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
    ['workSeconds', 'Work time'],
    ['restSeconds', 'Rest time'],
  ] as const) {
    if (
      !isPositiveInteger(
        block[field],
        WORKOUT_LIMITS.maxIntervalSeconds,
      )
    ) {
      issues.push({
        path: `${blockPath}.${field}`,
        message: `${label} must be between 1 and ${WORKOUT_LIMITS.maxIntervalSeconds} seconds.`,
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
      message: `A circuit can contain at most ${WORKOUT_LIMITS.maxExercisesPerCircuit} exercises.`,
    })
  }

  block.exercises.forEach((exercise, exerciseIndex) => {
    const exercisePath = `${blockPath}.exercises.${exerciseIndex}`
    validateName(
      exercise.name,
      `${exercisePath}.name`,
      'Exercise name',
      issues,
    )

    if (exercise.roundCues.length > block.rounds) {
      issues.push({
        path: `${exercisePath}.roundCues`,
        message: 'An exercise cannot have more cues than circuit rounds.',
      })
    }

    exercise.roundCues.forEach((cue, cueIndex) => {
      if (cue.length > WORKOUT_LIMITS.maxCueLength) {
        issues.push({
          path: `${exercisePath}.roundCues.${cueIndex}`,
          message: `A cue must be ${WORKOUT_LIMITS.maxCueLength} characters or fewer.`,
        })
      }
    })
  })
}

export function validateWorkout(workout: Workout): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  validateName(workout.name, 'name', 'Workout name', issues)

  if (workout.blocks.length === 0) {
    issues.push({ path: 'blocks', message: 'Add at least one workout block.' })
  } else if (workout.blocks.length > WORKOUT_LIMITS.maxBlocks) {
    issues.push({
      path: 'blocks',
      message: `A workout can contain at most ${WORKOUT_LIMITS.maxBlocks} blocks.`,
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
          message: `Duration must be between 1 and ${WORKOUT_LIMITS.maxIntervalSeconds} seconds.`,
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
        message: 'The total workout duration cannot exceed 8 hours.',
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

export function compileWorkout(workout: Workout): WorkoutTimeline {
  const issues = validateWorkout(workout)
  if (issues.length > 0) {
    throw new WorkoutValidationError(issues)
  }

  const intervals: TimelineInterval[] = []

  workout.blocks.forEach((block) => {
    if (block.type === 'phase') {
      intervals.push({
        id: block.id,
        blockId: block.id,
        kind: 'phase',
        tone: block.tone,
        label: block.name.trim(),
        durationSeconds: block.durationSeconds,
      })
      return
    }

    for (let roundIndex = 0; roundIndex < block.rounds; roundIndex += 1) {
      block.exercises.forEach((exercise, exerciseIndex) => {
        const sequenceId = `${block.id}-${roundIndex}-${exerciseIndex}`
        const cue = exercise.roundCues[roundIndex]?.trim()
        intervals.push({
          id: `${sequenceId}-work`,
          blockId: block.id,
          kind: 'work',
          tone: 'work',
          label: exercise.name.trim(),
          detail: cue || undefined,
          durationSeconds: block.workSeconds,
          round: roundIndex + 1,
          totalRounds: block.rounds,
          exercise: exerciseIndex + 1,
          totalExercises: block.exercises.length,
        })
        intervals.push({
          id: `${sequenceId}-rest`,
          blockId: block.id,
          kind: 'rest',
          tone: 'rest',
          label: 'Rest',
          durationSeconds: block.restSeconds,
          round: roundIndex + 1,
          totalRounds: block.rounds,
          exercise: exerciseIndex + 1,
          totalExercises: block.exercises.length,
        })
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
  return randomId ? `${prefix}-${randomId}` : `${prefix}-${Math.random().toString(36).slice(2)}`
}

export function createPhaseBlock(
  name = 'New phase',
  durationSeconds = 5 * 60,
  tone: PhaseTone = 'custom',
): WorkoutBlock {
  return {
    id: createId('phase'),
    type: 'phase',
    name,
    durationSeconds,
    tone,
  }
}

export function createCircuitBlock(): WorkoutBlock {
  return {
    id: createId('circuit'),
    type: 'circuit',
    name: 'New circuit',
    rounds: 3,
    workSeconds: 45,
    restSeconds: 15,
    exercises: [
      {
        id: createId('exercise'),
        name: 'Exercise',
        roundCues: [],
      },
    ],
  }
}

export function cloneWorkout(workout: Workout): Workout {
  return {
    ...structuredClone(workout),
    id: createId('custom'),
    scheduledDay: undefined,
  }
}
