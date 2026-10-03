import type { PresetSlug, Workout } from '../types/workout'

export const PRESET_WORKOUTS: Record<PresetSlug, Workout> = {
  tuesday: {
    id: 'preset-tuesday',
    name: 'Tuesday strength',
    scheduledDay: 'Tuesday',
    blocks: [
      {
        id: 'tuesday-run',
        type: 'phase',
        name: 'Run + stretch',
        durationSeconds: 25 * 60,
        tone: 'warmup',
      },
      {
        id: 'tuesday-setup',
        type: 'phase',
        name: 'Set up',
        durationSeconds: 5 * 60,
        tone: 'setup',
      },
      {
        id: 'tuesday-circuit',
        type: 'circuit',
        name: 'Arms + core',
        rounds: 3,
        workSeconds: 45,
        restSeconds: 15,
        exercises: [
          {
            id: 'tuesday-curls',
            name: 'Bicep curls',
            roundCues: ['15 lb', '20 lb', '20 lb'],
          },
          {
            id: 'tuesday-plank-one',
            name: 'Plank',
            roundCues: [],
          },
          {
            id: 'tuesday-triceps',
            name: 'Triceps',
            roundCues: ['5 lb', '5 lb', '5 lb'],
          },
          {
            id: 'tuesday-plank-two',
            name: 'Plank',
            roundCues: [],
          },
        ],
      },
      {
        id: 'tuesday-cleanup',
        type: 'phase',
        name: 'Clean up',
        durationSeconds: 5 * 60,
        tone: 'cleanup',
      },
    ],
  },
  wednesday: {
    id: 'preset-wednesday',
    name: 'Wednesday conditioning',
    scheduledDay: 'Wednesday',
    blocks: [
      {
        id: 'wednesday-run',
        type: 'phase',
        name: 'Run + stretch',
        durationSeconds: 25 * 60,
        tone: 'warmup',
      },
      {
        id: 'wednesday-setup',
        type: 'phase',
        name: 'Set up',
        durationSeconds: 5 * 60,
        tone: 'setup',
      },
      {
        id: 'wednesday-circuit',
        type: 'circuit',
        name: 'Bodyweight conditioning',
        rounds: 3,
        workSeconds: 45,
        restSeconds: 15,
        exercises: [
          {
            id: 'wednesday-pullups',
            name: 'Pullups',
            roundCues: [],
          },
          {
            id: 'wednesday-jumprope',
            name: 'Jump rope',
            roundCues: [],
          },
          {
            id: 'wednesday-pushups',
            name: 'Pushups',
            roundCues: [],
          },
          {
            id: 'wednesday-v-sits',
            name: 'V-sits',
            roundCues: [],
          },
        ],
      },
      {
        id: 'wednesday-cleanup',
        type: 'phase',
        name: 'Clean up',
        durationSeconds: 5 * 60,
        tone: 'cleanup',
      },
    ],
  },
  friday: {
    id: 'preset-friday',
    name: 'Friday shoulders',
    scheduledDay: 'Friday',
    blocks: [
      {
        id: 'friday-run',
        type: 'phase',
        name: 'Run + stretch',
        durationSeconds: 25 * 60,
        tone: 'warmup',
      },
      {
        id: 'friday-setup',
        type: 'phase',
        name: 'Set up',
        durationSeconds: 5 * 60,
        tone: 'setup',
      },
      {
        id: 'friday-circuit',
        type: 'circuit',
        name: 'Shoulders + side core',
        rounds: 3,
        workSeconds: 45,
        restSeconds: 15,
        exercises: [
          {
            id: 'friday-front-raise',
            name: 'Front raise',
            roundCues: ['10 lb', '15 lb', '15 lb'],
          },
          {
            id: 'friday-side-plank-left',
            name: 'Side plank',
            roundCues: ['Left', 'Left', 'Left'],
          },
          {
            id: 'friday-lateral-raise',
            name: 'Lateral raise',
            roundCues: ['10 lb', '15 lb', '15 lb'],
          },
          {
            id: 'friday-side-plank-right',
            name: 'Side plank',
            roundCues: ['Right', 'Right', 'Right'],
          },
        ],
      },
      {
        id: 'friday-cleanup',
        type: 'phase',
        name: 'Clean up',
        durationSeconds: 5 * 60,
        tone: 'cleanup',
      },
    ],
  },
}

export const PRESET_SLUGS: PresetSlug[] = [
  'tuesday',
  'wednesday',
  'friday',
]

export function isPresetSlug(value: string): value is PresetSlug {
  return PRESET_SLUGS.includes(value as PresetSlug)
}

export function getTodaysPreset(date = new Date()) {
  const dayToPreset: Partial<Record<number, PresetSlug>> = {
    2: 'tuesday',
    3: 'wednesday',
    5: 'friday',
  }
  return dayToPreset[date.getDay()] ?? 'tuesday'
}
