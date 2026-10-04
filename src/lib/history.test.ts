import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import type { WorkoutRun } from '../types/workout'
import { describeRun, groupWorkoutsForHome, scheduleLabel } from './history'

// Saturday, October 3, 2026, mid-morning local time.
const NOW = new Date(2026, 9, 3, 10, 0).getTime()
const day = (date: number, hour = 18) => new Date(2026, 8, date, hour).getTime()
const [tuesday, wednesday, friday] = createSeedWorkouts(0)

function run(overrides: Partial<WorkoutRun>): WorkoutRun {
  return {
    id: 'run',
    workoutId: tuesday.id,
    workoutName: tuesday.name,
    startedAt: NOW,
    updatedAt: NOW,
    elapsedSeconds: 0,
    totalSeconds: 47 * 60,
    completed: false,
    ...overrides,
  }
}

describe('run descriptions', () => {
  it('describes a completed run', () => {
    const completed = run({
      startedAt: new Date(2026, 9, 2, 18).getTime(),
      completed: true,
      elapsedSeconds: 47 * 60,
    })

    expect(describeRun(completed, NOW)).toBe('Yesterday · 47 min · completed')
  })

  it('describes how far a stopped run got', () => {
    const stopped = run({ startedAt: day(29), elapsedSeconds: 31 * 60 + 40 })

    expect(describeRun(stopped, NOW)).toBe('Sep 29 · stopped at 31:40 of 47:00')
  })

  it('includes the year for older runs', () => {
    const old = run({ startedAt: new Date(2025, 11, 30).getTime(), completed: true })

    expect(describeRun(old, NOW)).toBe('Dec 30, 2025 · 47 min · completed')
  })
})

describe('home ordering', () => {
  it('sorts run workouts by last run and keeps the rest apart', () => {
    const runs = [
      run({ id: 'a', workoutId: tuesday.id, startedAt: day(29) }),
      run({ id: 'b', workoutId: wednesday.id, startedAt: day(30) }),
      run({ id: 'c', workoutId: tuesday.id, startedAt: day(20) }),
    ]

    const { recent, notRun } = groupWorkoutsForHome(
      [tuesday, wednesday, friday],
      runs,
    )

    expect(recent.map(({ workout, run }) => [workout.name, run.id])).toEqual([
      ['Wednesday bodyweight', 'b'],
      ['Tuesday arms', 'a'],
    ])
    expect(notRun.map((workout) => workout.name)).toEqual(['Friday shoulders'])
  })
})

describe('schedule label', () => {
  const workouts = [tuesday, wednesday, friday]

  it('names the next scheduled workout', () => {
    expect(scheduleLabel(workouts, NOW)).toBe('next scheduled: Tuesday arms')
  })

  it('reads "Up today" on a scheduled day', () => {
    const tuesdayMorning = new Date(2026, 9, 6, 8).getTime()

    expect(scheduleLabel(workouts, tuesdayMorning)).toBe('Up today: Tuesday arms')
  })

  it('is empty when nothing is scheduled', () => {
    expect(scheduleLabel([{ ...tuesday, days: [] }], NOW)).toBeNull()
  })
})
