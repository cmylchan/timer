export function formatDuration(totalSeconds: number) {
  const roundedSeconds = Math.max(0, Math.ceil(totalSeconds))
  const hours = Math.floor(roundedSeconds / 3600)
  const minutes = Math.floor((roundedSeconds % 3600) / 60)
  const seconds = roundedSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** "45s" for short intervals, "5:00" from a minute up. */
export function formatIntervalLength(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  return seconds < 60 ? `${seconds}s` : formatDuration(seconds)
}

/** "47 min", or "30 sec" for anything under a minute. */
export function formatMinutes(totalSeconds: number) {
  return totalSeconds < 60
    ? `${Math.round(totalSeconds)} sec`
    : `${Math.round(totalSeconds / 60)} min`
}

/**
 * Reads "25:00", "45s", "2m", or a bare number. A bare number is read in
 * `bareUnit`: minutes for timed blocks, seconds for work and rest.
 * Returns `undefined` when the text is not a duration.
 */
export function parseDurationInput(
  text: string,
  bareUnit: 'minutes' | 'seconds',
) {
  const value = text.trim().toLowerCase()
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(value)
  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2])
  }
  const unit = /^(\d{1,5})\s*(s|sec|secs|m|min|mins)?$/.exec(value)
  if (!unit) {
    return undefined
  }
  const amount = Number(unit[1])
  const suffix = unit[2]
  if (suffix?.startsWith('m') || (!suffix && bareUnit === 'minutes')) {
    return amount * 60
  }
  return amount
}

function startOfDay(epochMs: number) {
  const date = new Date(epochMs)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** "Today", "Yesterday", "Sep 30", or "Sep 30, 2025" for other years. */
export function formatRunDate(epochMs: number, nowMs = Date.now()) {
  const days = Math.round((startOfDay(nowMs) - startOfDay(epochMs)) / 86_400_000)
  if (days === 0) {
    return 'Today'
  }
  if (days === 1) {
    return 'Yesterday'
  }
  const sameYear =
    new Date(epochMs).getFullYear() === new Date(nowMs).getFullYear()
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(epochMs))
}

/** "Saturday, Oct 3" */
export function formatLongDate(epochMs: number) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(epochMs))
}

/** Lowercases a leading capital for use mid-sentence, leaving acronyms. */
export function toSentenceCase(text: string) {
  return /^[A-Z][a-z]/.test(text)
    ? text.charAt(0).toLowerCase() + text.slice(1)
    : text
}
