import { createSeedWorkouts } from '../data/seed'
import type { Workout, WorkoutRun } from '../types/workout'
import { normalizeWeights } from './weights'

export interface StoredData {
  workouts: Workout[]
  runs: WorkoutRun[]
}

/** Workouts and run history, kept on this device. */
export interface SignalStore {
  load(): Promise<StoredData>
  saveWorkout(workout: Workout): Promise<void>
  /** Removes the workout and its run history. */
  deleteWorkout(workoutId: string): Promise<void>
  saveRun(run: WorkoutRun): Promise<void>
}

const DB_NAME = 'signal'
const DB_VERSION = 1

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('The save was cancelled.'))
  })
}

function openDatabase(seed: () => Workout[]) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('This browser cannot store workouts.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      if (event.oldVersion < 1) {
        const workouts = db.createObjectStore('workouts', { keyPath: 'id' })
        const runs = db.createObjectStore('runs', { keyPath: 'id' })
        runs.createIndex('workoutId', 'workoutId')
        // Seeding inside the upgrade runs exactly once per device, so
        // deleting every workout later does not bring the seeds back.
        for (const workout of seed()) {
          workouts.put(workout)
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('Close other HIIT windows and reload.'))
  })
}

/** Fills fields a stored record might lack, so older data still loads. */
function normalizeWorkout(workout: Workout): Workout {
  return {
    ...workout,
    days: Array.isArray(workout.days) ? workout.days : [],
    createdAt: workout.createdAt ?? 0,
    blocks: workout.blocks.map((block) =>
      block.type === 'circuit'
        ? {
            ...block,
            order: block.order ?? 'circuit',
            exercises: block.exercises.map((exercise) => ({
              ...exercise,
              weights: normalizeWeights(exercise.weights ?? [], block.rounds),
            })),
          }
        : block,
    ),
  }
}

export function createIndexedDbStore(
  seed: () => Workout[] = createSeedWorkouts,
): SignalStore {
  let database: Promise<IDBDatabase> | null = null
  const db = () => (database ??= openDatabase(seed))

  return {
    async load() {
      const connection = await db()
      const transaction = connection.transaction(['workouts', 'runs'], 'readonly')
      const [workouts, runs] = await Promise.all([
        requestResult(transaction.objectStore('workouts').getAll() as IDBRequest<Workout[]>),
        requestResult(transaction.objectStore('runs').getAll() as IDBRequest<WorkoutRun[]>),
      ])
      return { workouts: workouts.map(normalizeWorkout), runs }
    },
    async saveWorkout(workout) {
      const transaction = (await db()).transaction('workouts', 'readwrite')
      transaction.objectStore('workouts').put(workout)
      await transactionDone(transaction)
    },
    async deleteWorkout(workoutId) {
      const transaction = (await db()).transaction(['workouts', 'runs'], 'readwrite')
      transaction.objectStore('workouts').delete(workoutId)
      const runs = transaction.objectStore('runs')
      const keys = await requestResult(
        runs.index('workoutId').getAllKeys(IDBKeyRange.only(workoutId)),
      )
      for (const key of keys) {
        runs.delete(key)
      }
      await transactionDone(transaction)
    },
    async saveRun(run) {
      const transaction = (await db()).transaction('runs', 'readwrite')
      transaction.objectStore('runs').put(run)
      await transactionDone(transaction)
    },
  }
}

/** Keeps everything in memory. Used by tests. */
export function createMemoryStore(initial: Partial<StoredData> = {}): SignalStore {
  let workouts = structuredClone(initial.workouts ?? createSeedWorkouts(0))
  let runs = structuredClone(initial.runs ?? [])

  return {
    async load() {
      return structuredClone({ workouts, runs })
    },
    async saveWorkout(workout) {
      workouts = [
        ...workouts.filter((candidate) => candidate.id !== workout.id),
        structuredClone(workout),
      ]
    },
    async deleteWorkout(workoutId) {
      workouts = workouts.filter((candidate) => candidate.id !== workoutId)
      runs = runs.filter((run) => run.workoutId !== workoutId)
    },
    async saveRun(run) {
      runs = [...runs.filter((candidate) => candidate.id !== run.id), structuredClone(run)]
    },
  }
}
