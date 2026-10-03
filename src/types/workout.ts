export const PHASE_TONES = [
  'warmup',
  'setup',
  'recovery',
  'cleanup',
  'custom',
] as const

export type PhaseTone = (typeof PHASE_TONES)[number]

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

export interface TimedPhaseBlock {
  id: string
  type: 'phase'
  name: string
  durationSeconds: number
  tone: PhaseTone
}

export interface CircuitExercise {
  id: string
  name: string
  roundCues: string[]
}

export interface CircuitBlock {
  id: string
  type: 'circuit'
  name: string
  rounds: number
  workSeconds: number
  restSeconds: number
  exercises: CircuitExercise[]
}

export type WorkoutBlock = TimedPhaseBlock | CircuitBlock

export interface Workout {
  id: string
  name: string
  scheduledDay?: Weekday
  blocks: WorkoutBlock[]
}

export type TimelineIntervalKind = 'phase' | 'work' | 'rest'

export interface TimelineInterval {
  id: string
  blockId: string
  kind: TimelineIntervalKind
  tone: PhaseTone | 'work' | 'rest'
  label: string
  detail?: string
  durationSeconds: number
  round?: number
  totalRounds?: number
  exercise?: number
  totalExercises?: number
}

export interface WorkoutTimeline {
  intervals: TimelineInterval[]
  intervalStartSeconds: number[]
  totalSeconds: number
}

export interface ValidationIssue {
  path: string
  message: string
}

export type PresetSlug = 'tuesday' | 'wednesday' | 'friday'
