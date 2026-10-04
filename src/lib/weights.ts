import type { RoundWeights, Workout } from '../types/workout'

export const MAX_WEIGHT_LB = 1000

/**
 * Sizes a weight list to the round count. New rounds repeat the last
 * round's weight, matching how a typed weight fills later rounds.
 */
export function normalizeWeights(
  weights: RoundWeights,
  rounds: number,
): RoundWeights {
  const count = Math.max(0, rounds)
  const last = weights.length > 0 ? (weights.at(-1) ?? null) : null
  return Array.from({ length: count }, (_, index) =>
    index < weights.length ? (weights[index] ?? null) : last,
  )
}

/**
 * Sets one round's weight. Later rounds that still matched this round's
 * old value follow the change, so "5 lb × 3" is one entry and
 * "15, 20, 20" is one overwrite.
 */
export function setRoundWeight(
  weights: RoundWeights,
  roundIndex: number,
  value: number | null,
): RoundWeights {
  const previous = weights[roundIndex] ?? null
  const next = [...weights]
  next[roundIndex] = value
  for (let index = roundIndex + 1; index < next.length; index += 1) {
    if ((next[index] ?? null) !== previous) {
      break
    }
    next[index] = value
  }
  return next
}

/** Returns a weight, `null` for blank, or `undefined` when invalid. */
export function parseWeight(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/\s*lbs?$/i, '')
  if (trimmed === '' || trimmed === '—' || trimmed === '-') {
    return null
  }
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(trimmed)) {
    return undefined
  }
  const value = Number.parseFloat(trimmed)
  return value > 0 && value <= MAX_WEIGHT_LB ? value : undefined
}

export function formatWeight(weight: number) {
  return `${weight} lb`
}

export interface Equipment {
  dumbbells: number[]
  extras: string[]
}

export function getEquipment(workout: Workout): Equipment {
  const dumbbells = new Set<number>()
  let needsMat = false
  let needsJumpRope = false

  for (const block of workout.blocks) {
    if (block.type !== 'circuit') {
      continue
    }
    for (const exercise of block.exercises) {
      if (/plank|v-sit/i.test(exercise.name)) {
        needsMat = true
      }
      if (/jump rope/i.test(exercise.name)) {
        needsJumpRope = true
      }
      for (const weight of exercise.weights.slice(0, block.rounds)) {
        if (weight !== null) {
          dumbbells.add(weight)
        }
      }
    }
  }

  const extras: string[] = []
  if (needsMat) {
    extras.push('Mat')
  }
  if (needsJumpRope) {
    extras.push('Jump rope')
  }
  return {
    dumbbells: [...dumbbells].sort((left, right) => left - right),
    extras,
  }
}

/** One line per item, for the setup checklist. */
export function equipmentChecklist(equipment: Equipment) {
  return [
    ...equipment.dumbbells.map((weight) => `${formatWeight(weight)} dumbbells`),
    ...equipment.extras,
  ]
}

/** Dumbbells grouped on one line, for the editor's summary rail. */
export function equipmentSummary(equipment: Equipment) {
  const lines =
    equipment.dumbbells.length > 0
      ? [`Dumbbells: ${equipment.dumbbells.join(', ')} lb`]
      : []
  return [...lines, ...equipment.extras]
}
