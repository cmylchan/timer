import { WEEK_ORDER, type Weekday } from '../types/workout'

export const SHORT_DAYS: Record<Weekday, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}

/** Days in week order, Monday first. */
export function orderDays(days: readonly Weekday[]) {
  return WEEK_ORDER.filter((day) => days.includes(day))
}

export function toggleDay(days: readonly Weekday[], day: Weekday) {
  return days.includes(day)
    ? days.filter((candidate) => candidate !== day)
    : orderDays([...days, day])
}
