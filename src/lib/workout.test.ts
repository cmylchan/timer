import { describe, expect, it } from 'vitest'
import { PRESET_SLUGS, PRESET_WORKOUTS } from '../data/presets'
import type { Workout } from '../types/workout'
import {
  calculateWorkoutDuration,
  compileWorkout,
  validateWorkout,
} from './workout'

describe('preset workouts', () => {
  it.each(PRESET_SLUGS)('%s compiles to exactly 47 minutes', (slug) => {
    const workout = PRESET_WORKOUTS[slug]
    const timeline = compileWorkout(workout)

    expect(calculateWorkoutDuration(workout)).toBe(47 * 60)
    expect(timeline.totalSeconds).toBe(47 * 60)
    expect(timeline.intervals).toHaveLength(27)
    expect(timeline.intervals.at(-2)).toMatchObject({
      kind: 'rest',
      durationSeconds: 15,
      round: 3,
      exercise: 4,
    })
    expect(timeline.intervals.at(-1)).toMatchObject({
      kind: 'phase',
      label: 'Clean up',
      durationSeconds: 300,
    })
  })

  it('uses the requested round-specific Tuesday weights', () => {
    const work = compileWorkout(PRESET_WORKOUTS.tuesday).intervals.filter(
      (interval) =>
        interval.kind === 'work' && interval.label === 'Bicep curls',
    )

    expect(work.map((interval) => interval.detail)).toEqual([
      '15 lb',
      '20 lb',
      '20 lb',
    ])
  })

  it('uses the requested Friday directions and weights', () => {
    const work = compileWorkout(PRESET_WORKOUTS.friday).intervals.filter(
      (interval) => interval.kind === 'work',
    )

    expect(
      work
        .filter((interval) => interval.label === 'Front raise')
        .map((interval) => interval.detail),
    ).toEqual(['10 lb', '15 lb', '15 lb'])
    expect(
      work
        .filter((interval) => interval.label === 'Side plank')
        .map((interval) => interval.detail),
    ).toEqual(['Left', 'Right', 'Left', 'Right', 'Left', 'Right'])
  })
})

describe('workout validation', () => {
  it('reports actionable paths for invalid fields', () => {
    const workout: Workout = {
      id: 'invalid',
      name: '',
      blocks: [
        {
          id: 'circuit',
          type: 'circuit',
          name: '',
          rounds: 0,
          workSeconds: 45,
          restSeconds: 15,
          exercises: [],
        },
      ],
    }

    expect(validateWorkout(workout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'blocks.0.name' }),
        expect.objectContaining({ path: 'blocks.0.rounds' }),
        expect.objectContaining({ path: 'blocks.0.exercises' }),
      ]),
    )
  })
})
