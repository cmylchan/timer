import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  HomeScreen,
  type NewWorkoutOptions,
} from './components/HomeScreen'
import { TimerScreen } from './components/TimerScreen'
import { WorkoutEditor } from './components/WorkoutEditor'
import {
  PRESET_WORKOUTS,
  getTodaysPreset,
} from './data/presets'
import {
  cloneWorkout,
  createId,
} from './lib/workout'
import {
  createCustomWorkoutHash,
  createPresetHash,
  readWorkoutHash,
  type WorkoutHashResult,
} from './lib/workoutUrl'
import type { PresetSlug, Workout } from './types/workout'

type Screen = 'home' | 'editor' | 'timer'

function getInitialHashResult() {
  return readWorkoutHash(window.location.hash)
}

function makeStarterWorkout(options: NewWorkoutOptions): Workout {
  if (options.source === 'blank') {
    return {
      id: createId('custom'),
      name: options.name,
      scheduledDay: options.scheduledDay,
      blocks: [],
    }
  }

  if (options.source === 'standard') {
    return {
      id: createId('custom'),
      name: options.name,
      scheduledDay: options.scheduledDay,
      blocks: [
        {
          id: createId('phase'),
          type: 'phase',
          name: 'Run / stretch',
          durationSeconds: 25 * 60,
          tone: 'warmup',
        },
        {
          id: createId('phase'),
          type: 'phase',
          name: 'Set up equipment',
          durationSeconds: 5 * 60,
          tone: 'setup',
        },
        {
          id: createId('circuit'),
          type: 'circuit',
          name: 'Circuit',
          rounds: 3,
          workSeconds: 45,
          restSeconds: 15,
          exercises: Array.from({ length: 4 }, (_, index) => ({
            id: createId('exercise'),
            name: `Exercise ${index + 1}`,
            roundCues: [],
          })),
        },
        {
          id: createId('phase'),
          type: 'phase',
          name: 'Put equipment away',
          durationSeconds: 5 * 60,
          tone: 'cleanup',
        },
      ],
    }
  }

  const source = PRESET_WORKOUTS[options.copySlug]
  return {
    ...cloneWorkout(source),
    name: options.name,
    scheduledDay: options.scheduledDay,
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [hashResult, setHashResult] =
    useState<WorkoutHashResult>(getInitialHashResult)
  const [editorWorkout, setEditorWorkout] = useState<Workout | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    const handleHashChange = () => {
      setHashResult(readWorkoutHash(window.location.hash))
      setCopied(false)
      setCopyError(null)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const fallbackSlug = useMemo(() => getTodaysPreset(), [])
  const selectedWorkout =
    hashResult.kind === 'preset' || hashResult.kind === 'custom'
      ? hashResult.workout
      : PRESET_WORKOUTS[fallbackSlug]
  const selectedSlug: PresetSlug | null =
    hashResult.kind === 'preset'
      ? hashResult.slug
      : hashResult.kind === 'custom'
        ? null
        : fallbackSlug

  const selectPreset = (slug: PresetSlug) => {
    const hash = createPresetHash(slug)
    window.location.hash = hash
    setHashResult({
      kind: 'preset',
      slug,
      workout: PRESET_WORKOUTS[slug],
    })
  }

  const startWorkout = (slug: PresetSlug | null) => {
    if (slug) {
      selectPreset(slug)
    }
    setScreen('timer')
  }

  const startEditing = (slug: PresetSlug | null) => {
    const workout = slug ? PRESET_WORKOUTS[slug] : selectedWorkout
    setEditorWorkout(cloneWorkout(workout))
    setScreen('editor')
  }

  const createWorkout = (options: NewWorkoutOptions) => {
    setEditorWorkout(makeStarterWorkout(options))
    setScreen('editor')
  }

  const saveWorkout = (workout: Workout) => {
    try {
      const hash = createCustomWorkoutHash(workout)
      window.location.hash = hash
      setHashResult(readWorkoutHash(hash))
      setScreen('home')
      return null
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'The workout link could not be created.'
    }
  }

  const copyLink = () => {
    if (!navigator.clipboard?.writeText) {
      setCopied(false)
      setCopyError(
        'Clipboard access is unavailable. Copy the URL from the address bar.',
      )
      return
    }
    setCopyError(null)
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => setCopied(true))
      .catch((error: unknown) => {
        setCopied(false)
        setCopyError(
          error instanceof Error
            ? `The link could not be copied: ${error.message}`
            : 'The link could not be copied.',
        )
      })
  }

  if (screen === 'timer') {
    return (
      <TimerScreen
        key={selectedWorkout.id}
        workout={selectedWorkout}
        onExit={() => setScreen('home')}
      />
    )
  }

  if (screen === 'editor' && editorWorkout) {
    return (
      <WorkoutEditor
        key={editorWorkout.id}
        initialWorkout={editorWorkout}
        onCancel={() => setScreen('home')}
        onSave={saveWorkout}
      />
    )
  }

  return (
    <HomeScreen
      selectedWorkout={selectedWorkout}
      selectedSlug={selectedSlug}
      hashError={hashResult.kind === 'error' ? hashResult.message : null}
      copied={copied}
      copyError={copyError}
      onClearInvalidLink={() => {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        )
        setHashResult({ kind: 'empty' })
      }}
      onStartWorkout={startWorkout}
      onEditWorkout={startEditing}
      onCreate={createWorkout}
      onCopyLink={copyLink}
    />
  )
}

export default App
