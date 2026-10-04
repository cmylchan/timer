import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import type { Workout } from '../types/workout'
import {
  headsUpAnnouncement,
  spokenDuration,
  startAnnouncement,
} from './announcements'
import { compileWorkout, createCircuitBlock, createPhaseBlock } from './workout'

const tuesday = createSeedWorkouts(0)[0]
const { intervals } = compileWorkout(tuesday)
const last = intervals.length - 1

function workout(blocks: Workout['blocks']): Workout {
  return { id: 'test', name: 'Test', days: [], createdAt: 0, blocks }
}

describe('interval callouts', () => {
  it('names each block and how long it runs', () => {
    expect(startAnnouncement(intervals, 0)).toBe('Warm-up, 25 minutes.')
    expect(startAnnouncement(intervals, 1)).toBe('Setup, 5 minutes.')
    expect(startAnnouncement(intervals, last)).toBe('Cleanup, 5 minutes.')
  })

  it('names each exercise with its weight', () => {
    expect(startAnnouncement(intervals, 2)).toBe('Bicep curls, 15 pounds.')
    expect(startAnnouncement(intervals, 4)).toBe('Plank.')
  })

  it('says what is next during a rest', () => {
    expect(startAnnouncement(intervals, 3)).toBe('Rest. Next: plank.')
    expect(startAnnouncement(intervals, 5)).toBe(
      'Rest. Next: tricep extension, 5 pounds.',
    )
    expect(startAnnouncement(intervals, last - 1)).toBe('Rest. Next: cleanup.')
  })

  it('says which weight to grab when it changes', () => {
    // Round 1 ends with a rest before round 2's 20 lb curls.
    expect(startAnnouncement(intervals, 9)).toBe(
      'Rest. Next: bicep curls. Grab 20 pounds.',
    )
  })

  it('says when the last rest ends the workout', () => {
    const circuit = compileWorkout(workout([createCircuitBlock()])).intervals
    expect(startAnnouncement(circuit, circuit.length - 1)).toBe(
      'Rest. Almost done.',
    )
  })

  it('does not read a slash aloud', () => {
    const { intervals: custom } = compileWorkout(
      workout([createPhaseBlock('custom', 'Foam roll / stretch', 90)]),
    )
    expect(startAnnouncement(custom, 0)).toBe(
      'Foam roll, stretch, 1 minute 30 seconds.',
    )
  })
})

describe('heads-up before a block ends', () => {
  it('calls out what is next', () => {
    expect(headsUpAnnouncement(intervals, 0)).toBe('Up next: setup.')
    expect(headsUpAnnouncement(intervals, 1)).toBe(
      'Up next: bicep curls, 15 pounds.',
    )
  })

  it('stays quiet in circuits, short blocks, and the last block', () => {
    expect(headsUpAnnouncement(intervals, 2)).toBeNull()
    expect(headsUpAnnouncement(intervals, 3)).toBeNull()
    expect(headsUpAnnouncement(intervals, last)).toBeNull()

    const { intervals: short } = compileWorkout(
      workout([
        createPhaseBlock('setup', 'Setup', 20),
        createPhaseBlock('cleanup', 'Cleanup', 60),
      ]),
    )
    expect(headsUpAnnouncement(short, 0)).toBeNull()
  })
})

describe('spoken durations', () => {
  it('reads minutes and seconds', () => {
    expect(spokenDuration(25 * 60)).toBe('25 minutes')
    expect(spokenDuration(60)).toBe('1 minute')
    expect(spokenDuration(90)).toBe('1 minute 30 seconds')
    expect(spokenDuration(45)).toBe('45 seconds')
    expect(spokenDuration(1)).toBe('1 second')
  })
})
