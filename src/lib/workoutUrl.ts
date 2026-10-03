import {
  compressToUint8Array,
  decompressFromUint8Array,
} from 'lz-string'
import { PRESET_WORKOUTS, isPresetSlug } from '../data/presets'
import {
  PHASE_TONES,
  WEEKDAYS,
  type PhaseTone,
  type PresetSlug,
  type Weekday,
  type Workout,
  type WorkoutBlock,
} from '../types/workout'
import {
  WORKOUT_LIMITS,
  WorkoutValidationError,
  createId,
  validateWorkout,
} from './workout'

const URL_SCHEMA_VERSION = 1
const MAX_ENCODED_WORKOUT_LENGTH = 24_000

interface CompactPhase {
  t: 'p'
  n: string
  d: number
  k: PhaseTone
}

interface CompactExercise {
  n: string
  c?: string[]
}

interface CompactCircuit {
  t: 'c'
  n: string
  r: number
  w: number
  s: number
  e: CompactExercise[]
}

interface CompactWorkout {
  v: 1
  n: string
  d?: Weekday
  b: Array<CompactPhase | CompactCircuit>
}

export type WorkoutHashResult =
  | { kind: 'empty' }
  | { kind: 'preset'; slug: PresetSlug; workout: Workout }
  | { kind: 'custom'; workout: Workout }
  | { kind: 'error'; message: string }

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error('The workout link contains invalid characters.')
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function toCompactWorkout(workout: Workout): CompactWorkout {
  return {
    v: URL_SCHEMA_VERSION,
    n: workout.name.trim(),
    d: workout.scheduledDay,
    b: workout.blocks.map((block) => {
      if (block.type === 'phase') {
        return {
          t: 'p',
          n: block.name.trim(),
          d: block.durationSeconds,
          k: block.tone,
        }
      }
      return {
        t: 'c',
        n: block.name.trim(),
        r: block.rounds,
        w: block.workSeconds,
        s: block.restSeconds,
        e: block.exercises.map((exercise) => ({
          n: exercise.name.trim(),
          c:
            exercise.roundCues.length > 0
              ? exercise.roundCues.map((cue) => cue.trim())
              : undefined,
        })),
      }
    }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(
  record: Record<string, unknown>,
  key: string,
  label: string,
) {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(`${label} is missing or invalid.`)
  }
  return value
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  label: string,
) {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is missing or invalid.`)
  }
  return value
}

function parsePhase(value: Record<string, unknown>, index: number): WorkoutBlock {
  const tone = value.k
  if (
    typeof tone !== 'string' ||
    !PHASE_TONES.includes(tone as PhaseTone)
  ) {
    throw new Error(`Phase ${index + 1} has an invalid style.`)
  }

  return {
    id: createId('phase'),
    type: 'phase',
    name: readString(value, 'n', `Phase ${index + 1} name`),
    durationSeconds: readNumber(
      value,
      'd',
      `Phase ${index + 1} duration`,
    ),
    tone: tone as PhaseTone,
  }
}

function parseCircuit(
  value: Record<string, unknown>,
  index: number,
): WorkoutBlock {
  if (!Array.isArray(value.e)) {
    throw new Error(`Circuit ${index + 1} exercises are missing or invalid.`)
  }
  if (value.e.length > WORKOUT_LIMITS.maxExercisesPerCircuit) {
    throw new Error(
      `Circuit ${index + 1} contains too many exercises.`,
    )
  }

  return {
    id: createId('circuit'),
    type: 'circuit',
    name: readString(value, 'n', `Circuit ${index + 1} name`),
    rounds: readNumber(value, 'r', `Circuit ${index + 1} rounds`),
    workSeconds: readNumber(value, 'w', `Circuit ${index + 1} work time`),
    restSeconds: readNumber(value, 's', `Circuit ${index + 1} rest time`),
    exercises: value.e.map((exercise, exerciseIndex) => {
      if (!isRecord(exercise)) {
        throw new Error(
          `Exercise ${exerciseIndex + 1} in circuit ${index + 1} is invalid.`,
        )
      }
      const cues = exercise.c
      if (
        cues !== undefined &&
        (!Array.isArray(cues) ||
          cues.some((cue) => typeof cue !== 'string'))
      ) {
        throw new Error(
          `Exercise ${exerciseIndex + 1} in circuit ${index + 1} has invalid cues.`,
        )
      }
      return {
        id: createId('exercise'),
        name: readString(
          exercise,
          'n',
          `Exercise ${exerciseIndex + 1} name`,
        ),
        roundCues: (cues as string[] | undefined) ?? [],
      }
    }),
  }
}

function parseCompactWorkout(value: unknown): Workout {
  if (!isRecord(value)) {
    throw new Error('The workout data is not an object.')
  }
  if (value.v !== URL_SCHEMA_VERSION) {
    throw new Error('This workout link uses an unsupported version.')
  }
  if (!Array.isArray(value.b)) {
    throw new Error('The workout blocks are missing or invalid.')
  }
  if (value.b.length > WORKOUT_LIMITS.maxBlocks) {
    throw new Error('The workout contains too many blocks.')
  }

  const scheduledDay = value.d
  if (
    scheduledDay !== undefined &&
    (typeof scheduledDay !== 'string' ||
      !WEEKDAYS.includes(scheduledDay as Weekday))
  ) {
    throw new Error('The scheduled day is invalid.')
  }

  const workout: Workout = {
    id: createId('custom'),
    name: readString(value, 'n', 'Workout name'),
    scheduledDay: scheduledDay as Weekday | undefined,
    blocks: value.b.map((block, index) => {
      if (!isRecord(block)) {
        throw new Error(`Block ${index + 1} is invalid.`)
      }
      if (block.t === 'p') {
        return parsePhase(block, index)
      }
      if (block.t === 'c') {
        return parseCircuit(block, index)
      }
      throw new Error(`Block ${index + 1} has an unsupported type.`)
    }),
  }

  const issues = validateWorkout(workout)
  if (issues.length > 0) {
    throw new WorkoutValidationError(issues)
  }
  return workout
}

export function createPresetHash(slug: PresetSlug) {
  return `#preset=${slug}`
}

export function createCustomWorkoutHash(workout: Workout) {
  const issues = validateWorkout(workout)
  if (issues.length > 0) {
    throw new WorkoutValidationError(issues)
  }

  const compressed = compressToUint8Array(
    JSON.stringify(toCompactWorkout(workout)),
  )
  const encoded = bytesToBase64Url(compressed)
  if (encoded.length > MAX_ENCODED_WORKOUT_LENGTH) {
    throw new Error('This workout is too large to store safely in a URL.')
  }
  return `#workout=v${URL_SCHEMA_VERSION}.${encoded}`
}

export function readWorkoutHash(hash: string): WorkoutHashResult {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  if (!rawHash) {
    return { kind: 'empty' }
  }

  const parameters = new URLSearchParams(rawHash)
  const preset = parameters.get('preset')
  if (preset !== null) {
    if (!isPresetSlug(preset)) {
      return {
        kind: 'error',
        message: `“${preset}” is not a known preset workout.`,
      }
    }
    return {
      kind: 'preset',
      slug: preset,
      workout: PRESET_WORKOUTS[preset],
    }
  }

  const custom = parameters.get('workout')
  if (custom === null) {
    return {
      kind: 'error',
      message: 'This link does not contain a recognized workout.',
    }
  }
  if (custom.length > MAX_ENCODED_WORKOUT_LENGTH + 3) {
    return {
      kind: 'error',
      message: 'This workout link is too large to open safely.',
    }
  }

  const separatorIndex = custom.indexOf('.')
  const version = custom.slice(0, separatorIndex)
  const payload = custom.slice(separatorIndex + 1)
  if (separatorIndex < 0 || version !== `v${URL_SCHEMA_VERSION}` || !payload) {
    return {
      kind: 'error',
      message: 'This workout link uses an unsupported or incomplete format.',
    }
  }

  try {
    const decompressed = decompressFromUint8Array(
      base64UrlToBytes(payload),
    )
    if (!decompressed) {
      throw new Error('The compressed workout data is empty.')
    }
    const parsed: unknown = JSON.parse(decompressed)
    return { kind: 'custom', workout: parseCompactWorkout(parsed) }
  } catch (error) {
    const message =
      error instanceof WorkoutValidationError
        ? error.issues[0]?.message
        : error instanceof Error
          ? error.message
          : 'The workout data could not be read.'
    return {
      kind: 'error',
      message: `This workout link is invalid. ${message ?? ''}`.trim(),
    }
  }
}
