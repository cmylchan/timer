import { createCircuitBlock, createId, createPhaseBlock } from '../lib/workout'
import type {
  CircuitExercise,
  TimedPhaseBlock,
  Weekday,
  Workout,
  WorkoutBlock,
} from '../types/workout'

function phase(
  id: string,
  tone: TimedPhaseBlock['tone'],
  name: string,
  minutes: number,
): TimedPhaseBlock {
  return { id, type: 'phase', name, durationSeconds: minutes * 60, tone }
}

function exercise(
  id: string,
  name: string,
  weights: Array<number | null> = [null, null, null],
): CircuitExercise {
  return { id, name, weights }
}

function seedWorkout(
  slug: string,
  name: string,
  day: Weekday,
  circuitName: string,
  exercises: CircuitExercise[],
  createdAt: number,
): Workout {
  return {
    id: `seed-${slug}`,
    name,
    days: [day],
    createdAt,
    blocks: [
      phase(`seed-${slug}-warmup`, 'warmup', 'Run / stretch', 25),
      phase(`seed-${slug}-setup`, 'setup', 'Set up equipment', 5),
      {
        id: `seed-${slug}-circuit`,
        type: 'circuit',
        name: circuitName,
        rounds: 3,
        workSeconds: 45,
        restSeconds: 15,
        order: 'circuit',
        exercises,
      },
      phase(`seed-${slug}-cleanup`, 'cleanup', 'Put equipment away', 5),
    ],
  }
}

/** The three workouts written to storage on first launch. */
export function createSeedWorkouts(now = Date.now()): Workout[] {
  return [
    seedWorkout(
      'tuesday',
      'Tuesday arms',
      'Tuesday',
      'Arms and core',
      [
        exercise('seed-tuesday-curls', 'Bicep curls', [15, 20, 20]),
        exercise('seed-tuesday-plank-1', 'Plank'),
        exercise('seed-tuesday-triceps', 'Tricep extension', [5, 5, 5]),
        exercise('seed-tuesday-plank-2', 'Plank'),
      ],
      now,
    ),
    seedWorkout(
      'wednesday',
      'Wednesday bodyweight',
      'Wednesday',
      'Bodyweight conditioning',
      [
        exercise('seed-wednesday-pullups', 'Pull-ups'),
        exercise('seed-wednesday-jumprope', 'Jump rope'),
        exercise('seed-wednesday-pushups', 'Push-ups'),
        exercise('seed-wednesday-vsits', 'V-sits'),
      ],
      now + 1,
    ),
    seedWorkout(
      'friday',
      'Friday shoulders',
      'Friday',
      'Shoulders and side core',
      [
        exercise('seed-friday-front-raise', 'Front raise', [10, 15, 15]),
        exercise('seed-friday-side-plank-left', 'Side plank, left'),
        exercise('seed-friday-lateral-raise', 'Lateral raise', [10, 15, 15]),
        exercise('seed-friday-side-plank-right', 'Side plank, right'),
      ],
      now + 2,
    ),
  ]
}

/** Warm-up 25 · setup 5 · circuit 3 × 4 · cleanup 5 */
export function createStandardBlocks(): WorkoutBlock[] {
  return [
    createPhaseBlock('warmup', 'Run / stretch', 25 * 60),
    createPhaseBlock('setup', 'Set up equipment', 5 * 60),
    createCircuitBlock('Circuit', [
      'Exercise 1',
      'Exercise 2',
      'Exercise 3',
      'Exercise 4',
    ]),
    createPhaseBlock('cleanup', 'Put equipment away', 5 * 60),
  ]
}

/** A stand-in workout with the standard shape, for previews. */
export const STANDARD_TEMPLATE: Workout = {
  id: createId('template'),
  name: 'Standard template',
  days: [],
  createdAt: 0,
  blocks: createStandardBlocks(),
}
