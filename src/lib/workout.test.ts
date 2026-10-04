import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import type { CircuitBlock, Workout } from '../types/workout'
import {
  calculateWorkoutDuration,
  cloneWorkout,
  compileWorkout,
  moveItem,
  validateWorkout,
} from './workout'

const seeds = createSeedWorkouts(0)
const tuesday = seeds[0]

describe('seed workouts', () => {
  it.each(seeds.map((workout) => [workout.name, workout] as const))(
    '%s compiles to 47 minutes in four blocks',
    (_, workout) => {
      const timeline = compileWorkout(workout)

      expect(workout.blocks).toHaveLength(4)
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
        tone: 'cleanup',
        blockIndex: 3,
        durationSeconds: 300,
      })
    },
  )

  it('weights Tuesday curls 15, 20, 20 lb and leaves planks bodyweight', () => {
    const work = compileWorkout(tuesday).intervals.filter(
      (interval) => interval.kind === 'work',
    )

    expect(
      work
        .filter((interval) => interval.label === 'Bicep curls')
        .map((interval) => interval.weight),
    ).toEqual([15, 20, 20])
    expect(
      work
        .filter((interval) => interval.label === 'Plank')
        .map((interval) => interval.weight),
    ).toEqual([null, null, null, null, null, null])
  })

  it('names Friday side planks by side', () => {
    const friday = seeds[2]
    const circuit = friday.blocks[2] as CircuitBlock

    expect(circuit.exercises.map((exercise) => exercise.name)).toEqual([
      'Front raise',
      'Side plank, left',
      'Lateral raise',
      'Side plank, right',
    ])
  })
})

describe('circuit order', () => {
  const twoByTwo: Workout = {
    id: 'order',
    name: 'Order',
    days: [],
    createdAt: 0,
    blocks: [
      {
        id: 'c',
        type: 'circuit',
        name: 'C',
        rounds: 2,
        workSeconds: 30,
        restSeconds: 10,
        order: 'circuit',
        exercises: [
          { id: 'a', name: 'A', weights: [5, 10] },
          { id: 'b', name: 'B', weights: [null, null] },
        ],
      },
    ],
  }

  const workLabels = (workout: Workout) =>
    compileWorkout(workout)
      .intervals.filter((interval) => interval.kind === 'work')
      .map((interval) => `${interval.label}${interval.round}`)

  it('runs every exercise, then repeats', () => {
    expect(workLabels(twoByTwo)).toEqual(['A1', 'B1', 'A2', 'B2'])
  })

  it('finishes each exercise first in sets order, keeping the duration', () => {
    const block = twoByTwo.blocks[0] as CircuitBlock
    const sets = { ...twoByTwo, blocks: [{ ...block, order: 'sets' as const }] }

    expect(workLabels(sets)).toEqual(['A1', 'A2', 'B1', 'B2'])
    expect(compileWorkout(sets).totalSeconds).toBe(
      compileWorkout(twoByTwo).totalSeconds,
    )
  })
})

describe('workout validation', () => {
  it('reports actionable paths for invalid fields', () => {
    const workout: Workout = {
      id: 'invalid',
      name: '',
      days: [],
      createdAt: 0,
      blocks: [
        {
          id: 'circuit',
          type: 'circuit',
          name: '',
          rounds: 0,
          workSeconds: 45,
          restSeconds: 15,
          order: 'circuit',
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

  it('requires at least one block', () => {
    expect(
      validateWorkout({ id: 'w', name: 'Blank', days: [], createdAt: 0, blocks: [] }),
    ).toEqual([expect.objectContaining({ path: 'blocks' })])
  })

  it('rejects impossible weights', () => {
    const block = tuesday.blocks[2] as CircuitBlock
    const workout = {
      ...tuesday,
      blocks: [
        {
          ...block,
          exercises: [{ ...block.exercises[0], weights: [15, -5, 20] }],
        },
      ],
    }

    expect(validateWorkout(workout)).toEqual([
      expect.objectContaining({ path: 'blocks.0.exercises.0.weights.1' }),
    ])
  })
})

describe('helpers', () => {
  it('clones with fresh ids', () => {
    const copy = cloneWorkout(tuesday, { name: 'Heavier Tuesday', days: [] })
    const copyCircuit = copy.blocks[2] as CircuitBlock
    const circuit = tuesday.blocks[2] as CircuitBlock

    expect(copy.name).toBe('Heavier Tuesday')
    expect(copy.id).not.toBe(tuesday.id)
    expect(copy.blocks.map((block) => block.id)).not.toContain(tuesday.blocks[0].id)
    expect(copyCircuit.exercises[0].id).not.toBe(circuit.exercises[0].id)
    expect(copyCircuit.exercises[0].weights).toEqual([15, 20, 20])
  })

  it('moves list items', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 1, 5)).toEqual(['a', 'b', 'c'])
  })
})
