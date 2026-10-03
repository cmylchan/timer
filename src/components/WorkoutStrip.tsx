import type { PhaseTone, Workout } from '../types/workout'

interface StripSegment {
  id: string
  tone: PhaseTone | 'work' | 'rest'
  duration: number
}

function getSegments(workout: Workout): StripSegment[] {
  const segments: StripSegment[] = []

  workout.blocks.forEach((block) => {
    if (block.type === 'phase') {
      segments.push({
        id: block.id,
        tone: block.tone,
        duration: Math.max(1, block.durationSeconds),
      })
      return
    }

    for (let round = 0; round < Math.max(0, block.rounds); round += 1) {
      block.exercises.forEach((exercise, exerciseIndex) => {
        const segmentId = `${block.id}-${round}-${exercise.id}-${exerciseIndex}`
        segments.push({
          id: `${segmentId}-work`,
          tone: 'work',
          duration: Math.max(1, block.workSeconds),
        })
        segments.push({
          id: `${segmentId}-rest`,
          tone: 'rest',
          duration: Math.max(1, block.restSeconds),
        })
      })
    }
  })

  return segments
}

export function WorkoutStrip({ workout }: { workout: Workout }) {
  const segments = getSegments(workout)

  return (
    <div className="workout-strip" aria-hidden="true">
      {segments.map((segment) => (
        <span
          className="workout-strip-segment"
          data-tone={segment.tone}
          key={segment.id}
          style={{ flexGrow: segment.duration }}
        />
      ))}
    </div>
  )
}
