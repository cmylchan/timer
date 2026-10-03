import { describe, expect, it } from 'vitest'
import { PRESET_WORKOUTS } from '../data/presets'
import { cloneWorkout } from './workout'
import {
  createCustomWorkoutHash,
  createPresetHash,
  readWorkoutHash,
} from './workoutUrl'

describe('workout URL codec', () => {
  it('round-trips a complete custom workout', () => {
    const workout = cloneWorkout(PRESET_WORKOUTS.tuesday)
    workout.name = 'Tuesday remix 🏋️'

    const result = readWorkoutHash(createCustomWorkoutHash(workout))

    expect(result.kind).toBe('custom')
    if (result.kind === 'custom') {
      expect(result.workout.name).toBe('Tuesday remix 🏋️')
      expect(result.workout.blocks).toEqual(
        workout.blocks.map((block) => ({
          ...block,
          id: expect.any(String),
          ...(block.type === 'circuit'
            ? {
                exercises: block.exercises.map((exercise) => ({
                  ...exercise,
                  id: expect.any(String),
                })),
              }
            : {}),
        })),
      )
    }
  })

  it('resolves stable preset slugs', () => {
    expect(readWorkoutHash(createPresetHash('friday'))).toEqual({
      kind: 'preset',
      slug: 'friday',
      workout: PRESET_WORKOUTS.friday,
    })
  })

  it.each([
    ['#preset=monday', 'not a known preset'],
    ['#workout=v2.abc', 'unsupported or incomplete'],
    ['#workout=v1.not+base64', 'invalid'],
    ['#unknown=value', 'recognized workout'],
  ])('rejects malformed hash %s', (hash, expectedMessage) => {
    const result = readWorkoutHash(hash)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toContain(expectedMessage)
    }
  })
})
