import type {
  IntervalTone,
  TimelineInterval,
  Workout,
} from '../types/workout'
import { formatIntervalLength } from './format'
import { formatWeight } from './weights'
import {
  blockListLabel,
  blockTone,
  calculateBlockDuration,
  toneLabel,
  toneColor,
} from './workout'

export interface QueueRow {
  key: string
  label: string
  value: string
  tone: IntervalTone
  /** Drawn inverted: the current interval, or the first one up in setup. */
  highlighted: boolean
  /** Previews the color the screen turns next. */
  dot: boolean
}

export interface Queue {
  mode: 'blocks' | 'intervals'
  rows: QueueRow[]
  /** The item after the current one, for the narrow-window line. */
  next: QueueRow | null
}

export const QUEUE_LENGTH = 6

export function intervalRowLabel(interval: TimelineInterval) {
  if (interval.kind === 'phase') {
    return interval.tone === 'custom' ? interval.label : toneLabel(interval.tone)
  }
  return interval.label
}

function intervalRow(
  interval: TimelineInterval,
  highlighted: boolean,
  dot: boolean,
): QueueRow {
  return {
    key: interval.id,
    label: intervalRowLabel(interval),
    value:
      interval.kind === 'work' && interval.weight != null
        ? formatWeight(interval.weight)
        : formatIntervalLength(interval.durationSeconds),
    tone: interval.tone,
    highlighted,
    dot,
  }
}

/**
 * Whole blocks during long blocks, single intervals inside a circuit and
 * in the block right before one.
 */
export function getQueue(
  workout: Workout,
  intervals: TimelineInterval[],
  index: number,
): Queue {
  const current = intervals[index]

  if (current.kind === 'phase') {
    const nextBlock = workout.blocks[current.blockIndex + 1]
    if (nextBlock?.type !== 'circuit') {
      const rows = workout.blocks
        .slice(current.blockIndex + 1, current.blockIndex + 1 + QUEUE_LENGTH)
        .map((block) => ({
          key: block.id,
          label: blockListLabel(block),
          value: formatIntervalLength(calculateBlockDuration(block)),
          tone: blockTone(block),
          highlighted: false,
          dot: false,
        }))
      return { mode: 'blocks', rows, next: rows[0] ?? null }
    }

    const rows = intervals
      .slice(index + 1, index + 1 + QUEUE_LENGTH)
      .map((interval, rowIndex) => intervalRow(interval, rowIndex === 0, false))
    return { mode: 'intervals', rows, next: rows[0] ?? null }
  }

  const currentColor = toneColor(current.tone)
  const rows = intervals
    .slice(index, index + QUEUE_LENGTH)
    .map((interval, rowIndex) =>
      intervalRow(
        interval,
        rowIndex === 0,
        rowIndex > 0 && toneColor(interval.tone) !== currentColor,
      ),
    )
  return { mode: 'intervals', rows, next: rows[1] ?? null }
}

/**
 * The weight to call out during a rest, when the next exercise uses a
 * different weight than its previous round.
 */
export function getWeightChange(
  intervals: TimelineInterval[],
  index: number,
): number | null {
  const current = intervals[index]
  const next = intervals[index + 1]
  if (current?.kind !== 'rest' || next?.kind !== 'work' || next.weight == null) {
    return null
  }

  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const interval = intervals[previous]
    if (interval.kind === 'work' && interval.exerciseId === next.exerciseId) {
      return interval.weight === next.weight ? null : next.weight
    }
  }
  return null
}
