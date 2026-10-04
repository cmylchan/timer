import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatIntervalLength,
  parseDurationInput,
  toSentenceCase,
} from './format'

describe('formatting', () => {
  it('formats clock durations', () => {
    expect(formatDuration(25 * 60)).toBe('25:00')
    expect(formatDuration(220)).toBe('3:40')
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('writes short intervals in seconds', () => {
    expect(formatIntervalLength(45)).toBe('45s')
    expect(formatIntervalLength(90)).toBe('1:30')
    expect(formatIntervalLength(12 * 60)).toBe('12:00')
  })

  it('lowercases a leading word mid-sentence, but not acronyms', () => {
    expect(toSentenceCase('Bicep curls')).toBe('bicep curls')
    expect(toSentenceCase('TRX row')).toBe('TRX row')
    expect(toSentenceCase('V-sits')).toBe('V-sits')
  })
})

describe('duration input', () => {
  it('reads clock times in both units', () => {
    expect(parseDurationInput('25:00', 'minutes')).toBe(1500)
    expect(parseDurationInput('1:30', 'seconds')).toBe(90)
  })

  it('reads a bare number in the field unit', () => {
    expect(parseDurationInput('25', 'minutes')).toBe(1500)
    expect(parseDurationInput('45', 'seconds')).toBe(45)
  })

  it('honors explicit units', () => {
    expect(parseDurationInput('45s', 'minutes')).toBe(45)
    expect(parseDurationInput('2 min', 'seconds')).toBe(120)
  })

  it('rejects text that is not a duration', () => {
    expect(parseDurationInput('25:', 'minutes')).toBeUndefined()
    expect(parseDurationInput('soon', 'seconds')).toBeUndefined()
  })
})
