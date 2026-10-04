import { WEEKDAYS, type Workout, type WorkoutRun } from '../types/workout'
import { formatDuration, formatMinutes, formatRunDate } from './format'

export function latestRuns(runs: WorkoutRun[]) {
  const latest = new Map<string, WorkoutRun>()
  for (const run of runs) {
    const known = latest.get(run.workoutId)
    if (!known || run.startedAt > known.startedAt) {
      latest.set(run.workoutId, run)
    }
  }
  return latest
}

export interface HomeLists {
  recent: Array<{ workout: Workout; run: WorkoutRun }>
  notRun: Workout[]
}

/** Run workouts sorted by last run, newest first; the rest by creation. */
export function groupWorkoutsForHome(
  workouts: Workout[],
  runs: WorkoutRun[],
): HomeLists {
  const latest = latestRuns(runs)
  const recent: HomeLists['recent'] = []
  const notRun: Workout[] = []
  for (const workout of workouts) {
    const run = latest.get(workout.id)
    if (run) {
      recent.push({ workout, run })
    } else {
      notRun.push(workout)
    }
  }
  recent.sort((left, right) => right.run.startedAt - left.run.startedAt)
  notRun.sort((left, right) => left.createdAt - right.createdAt)
  return { recent, notRun }
}

/** "Yesterday · 47 min · completed" or "Sep 29 · stopped at 31:40 of 47:00" */
export function describeRun(run: WorkoutRun, nowMs = Date.now()) {
  const date = formatRunDate(run.startedAt, nowMs)
  if (run.completed) {
    return `${date} · ${formatMinutes(run.totalSeconds)} · completed`
  }
  return `${date} · stopped at ${formatDuration(
    Math.floor(run.elapsedSeconds),
  )} of ${formatDuration(run.totalSeconds)}`
}

/** "Up today: Tuesday arms", "next scheduled: Tuesday arms", or null. */
export function scheduleLabel(workouts: Workout[], nowMs = Date.now()) {
  const today = new Date(nowMs).getDay()
  const ordered = [...workouts].sort(
    (left, right) => left.createdAt - right.createdAt,
  )
  for (let offset = 0; offset < 7; offset += 1) {
    const day = WEEKDAYS[(today + offset) % 7]
    const workout = ordered.find((candidate) => candidate.days.includes(day))
    if (workout) {
      return offset === 0
        ? `Up today: ${workout.name}`
        : `next scheduled: ${workout.name}`
    }
  }
  return null
}
