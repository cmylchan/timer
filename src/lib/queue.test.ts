import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import { getQueue, getWeightChange } from './queue'
import { compileWorkout } from './workout'

const tuesday = createSeedWorkouts(0)[0]
const { intervals } = compileWorkout(tuesday)
const rowsAt = (index: number) =>
  getQueue(tuesday, intervals, index).rows.map(
    ({ label, value, highlighted, dot }) => ({ label, value, highlighted, dot }),
  )

describe('queue rail', () => {
  it('lists whole blocks during the warm-up, without dots', () => {
    expect(rowsAt(0)).toEqual([
      { label: 'Setup', value: '5:00', highlighted: false, dot: false },
      { label: 'Circuit', value: '12:00', highlighted: false, dot: false },
      { label: 'Cleanup', value: '5:00', highlighted: false, dot: false },
    ])
  })

  it('previews the circuit during setup, first interval inverted', () => {
    expect(rowsAt(1).slice(0, 4)).toEqual([
      { label: 'Bicep curls', value: '15 lb', highlighted: true, dot: false },
      { label: 'Rest', value: '15s', highlighted: false, dot: false },
      { label: 'Plank', value: '45s', highlighted: false, dot: false },
      { label: 'Rest', value: '15s', highlighted: false, dot: false },
    ])
  })

  it('inverts the current interval and dots only color changes', () => {
    expect(rowsAt(2)).toEqual([
      { label: 'Bicep curls', value: '15 lb', highlighted: true, dot: false },
      { label: 'Rest', value: '15s', highlighted: false, dot: true },
      { label: 'Plank', value: '45s', highlighted: false, dot: false },
      { label: 'Rest', value: '15s', highlighted: false, dot: true },
      { label: 'Tricep extension', value: '5 lb', highlighted: false, dot: false },
      { label: 'Rest', value: '15s', highlighted: false, dot: true },
    ])
  })

  it('dots work rows during a rest', () => {
    const rest = 9
    expect(rowsAt(rest).slice(0, 3)).toEqual([
      { label: 'Rest', value: '15s', highlighted: true, dot: false },
      { label: 'Bicep curls', value: '20 lb', highlighted: false, dot: true },
      { label: 'Rest', value: '15s', highlighted: false, dot: false },
    ])
  })

  it('names the next item for the narrow-window line', () => {
    expect(getQueue(tuesday, intervals, 0).next?.label).toBe('Setup')
    expect(getQueue(tuesday, intervals, 1).next?.label).toBe('Bicep curls')
    expect(getQueue(tuesday, intervals, 2).next?.label).toBe('Rest')
    expect(getQueue(tuesday, intervals, intervals.length - 1).next).toBeNull()
  })
})

describe('weight change callout', () => {
  it('appears before an exercise whose weight differs from last round', () => {
    // Round 1 ends with a rest before round 2's 20 lb curls.
    expect(intervals[9]).toMatchObject({ kind: 'rest', round: 1, exercise: 4 })
    expect(getWeightChange(intervals, 9)).toBe(20)
  })

  it('stays hidden in the first round and when the weight repeats', () => {
    expect(getWeightChange(intervals, 3)).toBeNull()
    // Before round 3's curls, which repeat round 2's 20 lb.
    expect(getWeightChange(intervals, 17)).toBeNull()
  })
})
