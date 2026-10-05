import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import {
  equipmentChecklist,
  equipmentSummary,
  getEquipment,
  normalizeWeights,
  parseWeight,
  setRoundWeight,
} from './weights'

describe('per-round weights', () => {
  it('fills later rounds from a weight typed in R1', () => {
    expect(setRoundWeight([null, null, null], 0, 5)).toEqual([5, 5, 5])
  })

  it('makes 15, 20, 20 one overwrite after 15 × 3', () => {
    const fifteens = setRoundWeight([null, null, null], 0, 15)

    expect(setRoundWeight(fifteens, 1, 20)).toEqual([15, 20, 20])
  })

  it('stops filling at a round that was changed', () => {
    expect(setRoundWeight([15, 20, 20], 0, 10)).toEqual([10, 20, 20])
  })

  it('follows typing one character at a time', () => {
    let weights = setRoundWeight([15, 15, 15], 1, 2)
    weights = setRoundWeight(weights, 1, 20)

    expect(weights).toEqual([15, 20, 20])
  })

  it('sizes the list to the round count, repeating the last weight', () => {
    expect(normalizeWeights([15, 20], 4)).toEqual([15, 20, 20, 20])
    expect(normalizeWeights([15, 20, 20], 1)).toEqual([15])
    expect(normalizeWeights([], 2)).toEqual([null, null])
  })

  it('parses weights in lb, with blank as bodyweight', () => {
    expect(parseWeight('15')).toBe(15)
    expect(parseWeight('7.5 lb')).toBe(7.5)
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('—')).toBeNull()
    expect(parseWeight('abc')).toBeUndefined()
    expect(parseWeight('0')).toBeUndefined()
    expect(parseWeight('5000')).toBeUndefined()
  })
})

describe('equipment', () => {
  const [tuesday] = createSeedWorkouts(0)

  it('lists each dumbbell for the setup checklist', () => {
    expect(equipmentChecklist(getEquipment(tuesday))).toEqual([
      '5 lb dumbbells',
      '15 lb dumbbells',
      '20 lb dumbbells',
      'Mat',
    ])
  })

  it('groups dumbbells on one line for the editor summary', () => {
    expect(equipmentSummary(getEquipment(tuesday))).toEqual([
      'Dumbbells: 5, 15, 20 lb',
      'Mat',
    ])
  })

  it('finds bodyweight equipment from exercise names', () => {
    const bodyweight: typeof tuesday = {
      ...tuesday,
      blocks: [
        {
          ...tuesday.blocks[2],
          type: 'circuit',
          exercises: [
            { id: 'p1', name: 'Pull-ups', weights: [null] },
            { id: 'jr', name: 'Jump rope', weights: [null] },
          ],
        } as typeof tuesday.blocks[2],
      ],
    }
    expect(equipmentSummary(getEquipment(bodyweight))).toEqual(['Jump rope'])
  })
})
