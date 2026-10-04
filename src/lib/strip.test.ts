import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import type { CircuitBlock } from '../types/workout'
import { getStripSegments } from './strip'

const tuesday = createSeedWorkouts(0)[0]
const minutes = (detail: 'rounds' | 'blocks', workout = tuesday) =>
  getStripSegments(workout, detail).map(
    (segment) => `${segment.tone} ${segment.seconds / 60}`,
  )

describe('workout strip', () => {
  it('draws a circuit as work and rest per round on cards', () => {
    expect(minutes('rounds')).toEqual([
      'warmup 25',
      'setup 5',
      'work 3',
      'rest 1',
      'work 3',
      'rest 1',
      'work 3',
      'rest 1',
      'cleanup 5',
    ])
  })

  it('draws a circuit as total work and rest in the editor', () => {
    expect(minutes('blocks')).toEqual([
      'warmup 25',
      'setup 5',
      'work 9',
      'rest 3',
      'cleanup 5',
    ])
  })

  it('groups by exercise in sets order', () => {
    const circuit = tuesday.blocks[2] as CircuitBlock
    const sets = {
      ...tuesday,
      blocks: [{ ...circuit, order: 'sets' as const }],
    }

    expect(minutes('rounds', sets)).toEqual([
      'work 2.25',
      'rest 0.75',
      'work 2.25',
      'rest 0.75',
      'work 2.25',
      'rest 0.75',
      'work 2.25',
      'rest 0.75',
    ])
  })
})
