export const PHASE_TONES = [
  'warmup',
  'setup',
  'cleanup',
  'recovery',
  'custom',
] as const

export type PhaseTone = (typeof PHASE_TONES)[number]

export type IntervalTone = PhaseTone | 'work' | 'rest'

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

/** Day pickers and chips list the week starting on Monday. */
export const WEEK_ORDER: readonly Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export interface TimedPhaseBlock {
  id: string
  type: 'phase'
  name: string
  durationSeconds: number
  tone: PhaseTone
}

/** Weight in lb for each round. `null` means bodyweight. */
export type RoundWeights = Array<number | null>

export interface CircuitExercise {
  id: string
  name: string
  weights: RoundWeights
}

/**
 * `circuit` runs every exercise, then repeats (A B C D × 3).
 * `sets` finishes each exercise before moving on (A A A, B B B).
 */
export type CircuitOrder = 'circuit' | 'sets'

export interface CircuitBlock {
  id: string
  type: 'circuit'
  name: string
  rounds: number
  workSeconds: number
  restSeconds: number
  order: CircuitOrder
  exercises: CircuitExercise[]
}

export type WorkoutBlock = TimedPhaseBlock | CircuitBlock

export interface Workout {
  id: string
  name: string
  days: Weekday[]
  blocks: WorkoutBlock[]
  createdAt: number
}

export type TimelineIntervalKind = 'phase' | 'work' | 'rest'

export interface TimelineInterval {
  id: string
  blockId: string
  blockIndex: number
  kind: TimelineIntervalKind
  tone: IntervalTone
  label: string
  durationSeconds: number
  exerciseId?: string
  /** Work intervals only. `null` means bodyweight. */
  weight?: number | null
  round?: number
  totalRounds?: number
  exercise?: number
  totalExercises?: number
  order?: CircuitOrder
}

export interface WorkoutTimeline {
  intervals: TimelineInterval[]
  intervalStartSeconds: number[]
  totalSeconds: number
}

export interface WorkoutRun {
  id: string
  workoutId: string
  workoutName: string
  startedAt: number
  updatedAt: number
  elapsedSeconds: number
  totalSeconds: number
  completed: boolean
}

export interface ValidationIssue {
  path: string
  message: string
}
