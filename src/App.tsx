import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { HomeScreen } from './components/HomeScreen'
import { TimerScreen } from './components/TimerScreen'
import { WorkoutEditor } from './components/WorkoutEditor'
import {
  PRESET_WORKOUTS,
  getTodaysPreset,
} from './data/presets'
import {
  cloneWorkout,
  createCircuitBlock,
  createPhaseBlock,
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

function makeStarterWorkout(): Workout {
  return {
    id: 'custom-starter',
    name: 'My HIIT workout',
    blocks: [
      createPhaseBlock('Warm up', 5 * 60, 'warmup'),
      createCircuitBlock(),
      createPhaseBlock('Cool down', 5 * 60, 'cleanup'),
    ],
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
    window.location.hash = createPresetHash(slug)
    setScreen('home')
  }

  const startEditing = () => {
    setEditorWorkout(cloneWorkout(selectedWorkout))
    setScreen('editor')
  }

  const createWorkout = () => {
    setEditorWorkout(makeStarterWorkout())
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
      onSelectPreset={selectPreset}
      onStart={() => setScreen('timer')}
      onEdit={startEditing}
      onCreate={createWorkout}
      onCopyLink={copyLink}
    />
  )
}

export default App
