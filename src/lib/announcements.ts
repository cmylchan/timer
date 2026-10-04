import type { TimelineInterval } from '../types/workout'
import { toSentenceCase } from './format'
import { getWeightChange, intervalRowLabel } from './queue'

/** Blocks at least this long call out what's next before they end. */
const HEADS_UP_MIN_SECONDS = 30

/** How many seconds before a block ends its heads-up plays. */
export const HEADS_UP_SECONDS = 10

export const COMPLETE_ANNOUNCEMENT = 'Workout complete.'

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

/** "25 minutes", "1 minute 30 seconds", "45 seconds" */
export function spokenDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return [
    minutes > 0 ? plural(minutes, 'minute') : '',
    seconds > 0 || minutes === 0 ? plural(seconds, 'second') : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Speech engines read "/" aloud, so "Run / stretch" becomes "Run, stretch". */
function speakable(text: string) {
  return text.replace(/\s*\/\s*/g, ', ')
}

/** "Bicep curls, 15 pounds", "Plank", or a block's label, "Setup". */
function spokenName(interval: TimelineInterval) {
  const name = speakable(intervalRowLabel(interval))
  return interval.kind === 'work' && interval.weight != null
    ? `${name}, ${plural(interval.weight, 'pound')}`
    : name
}

/** What to say as an interval starts. Rests say what's next. */
export function startAnnouncement(
  intervals: TimelineInterval[],
  index: number,
) {
  const current = intervals[index]
  if (current.kind === 'phase') {
    return `${spokenName(current)}, ${spokenDuration(current.durationSeconds)}.`
  }
  if (current.kind === 'work') {
    return `${spokenName(current)}.`
  }

  const next = intervals[index + 1]
  if (!next) {
    return 'Rest. Almost done.'
  }
  const weightChange = getWeightChange(intervals, index)
  return weightChange === null
    ? `Rest. Next: ${toSentenceCase(spokenName(next))}.`
    : `Rest. Next: ${toSentenceCase(speakable(next.label))}. Grab ${plural(weightChange, 'pound')}.`
}

/**
 * What to say shortly before a long block ends, so there's time to get
 * ready. `null` when the interval doesn't get a heads-up.
 */
export function headsUpAnnouncement(
  intervals: TimelineInterval[],
  index: number,
) {
  const current = intervals[index]
  const next = intervals[index + 1]
  if (
    current.kind !== 'phase' ||
    current.durationSeconds < HEADS_UP_MIN_SECONDS ||
    !next
  ) {
    return null
  }
  return `Up next: ${toSentenceCase(spokenName(next))}.`
}
