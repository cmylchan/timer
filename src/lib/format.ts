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

export function formatLongDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds} sec`
  }
  if (seconds === 0) {
    return `${minutes} min`
  }
  return `${minutes} min ${seconds} sec`
}
