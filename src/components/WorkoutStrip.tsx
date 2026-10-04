import { getStripSegments } from '../lib/strip'
import type { Workout } from '../types/workout'

interface WorkoutStripProps {
  workout: Workout
  detail?: 'rounds' | 'blocks'
  className?: string
}

export function WorkoutStrip({
  workout,
  detail = 'rounds',
  className = '',
}: WorkoutStripProps) {
  return (
    <div className={`strip ${className}`} aria-hidden="true">
      {getStripSegments(workout, detail).map((segment) => (
        <span
          className="swatch"
          data-tone={segment.tone}
          key={segment.key}
          style={{ flexGrow: segment.seconds }}
        />
      ))}
    </div>
  )
}
