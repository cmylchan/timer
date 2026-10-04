import { toggleDay } from '../lib/days'
import { WEEK_ORDER, type Weekday } from '../types/workout'

interface DayPickerProps {
  days: Weekday[]
  onChange: (days: Weekday[]) => void
  compact?: boolean
}

export function DayPicker({ days, onChange, compact = false }: DayPickerProps) {
  return (
    <div
      className={`day-picker${compact ? ' is-compact' : ''}`}
      role="group"
      aria-label="Repeat on"
    >
      {WEEK_ORDER.map((day) => (
        <button
          className="day"
          type="button"
          key={day}
          aria-label={day}
          aria-pressed={days.includes(day)}
          onClick={() => onChange(toggleDay(days, day))}
        >
          {day.charAt(0)}
        </button>
      ))}
    </div>
  )
}
