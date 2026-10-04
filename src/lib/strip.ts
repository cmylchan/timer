import type { IntervalTone, Workout } from '../types/workout'

export interface StripSegment {
  key: string
  tone: IntervalTone
  seconds: number
}

/**
 * A workout's shape in phase colors, proportional to time.
 *
 * `rounds` draws a circuit as one work and one rest segment per round
 * (per exercise in sets order), as on the home cards. `blocks` draws a
 * circuit as its total work then its total rest, as in the editor rail.
 */
export function getStripSegments(
  workout: Workout,
  detail: 'rounds' | 'blocks',
): StripSegment[] {
  const segments: StripSegment[] = []

  for (const block of workout.blocks) {
    if (block.type === 'phase') {
      segments.push({
        key: block.id,
        tone: block.tone,
        seconds: Math.max(0, block.durationSeconds),
      })
      continue
    }

    const exercises = block.exercises.length
    const rounds = Math.max(0, block.rounds)
    const work = Math.max(0, block.workSeconds)
    const rest = Math.max(0, block.restSeconds)
    const groups =
      detail === 'blocks' ? 1 : block.order === 'sets' ? exercises : rounds
    const perGroup =
      detail === 'blocks'
        ? rounds * exercises
        : block.order === 'sets'
          ? rounds
          : exercises

    for (let group = 0; group < groups; group += 1) {
      segments.push(
        { key: `${block.id}-${group}-work`, tone: 'work', seconds: perGroup * work },
        { key: `${block.id}-${group}-rest`, tone: 'rest', seconds: perGroup * rest },
      )
    }
  }

  return segments.filter((segment) => segment.seconds > 0)
}
