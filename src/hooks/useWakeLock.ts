import { useEffect, useState } from 'react'

interface WakeLockState {
  supported: boolean
  active: boolean
  error: string | null
}

export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>({
    supported: 'wakeLock' in navigator,
    active: false,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    const wakeLock = 'wakeLock' in navigator ? navigator.wakeLock : null
    if (!wakeLock) {
      return
    }

    let disposed = false
    let sentinel: WakeLockSentinel | null = null

    const requestLock = async () => {
      if (document.visibilityState !== 'visible' || disposed) {
        return
      }
      try {
        sentinel = await wakeLock.request('screen')
        if (disposed) {
          await sentinel.release()
          return
        }
        setState({ supported: true, active: true, error: null })
        sentinel.addEventListener(
          'release',
          () => {
            if (!disposed) {
              setState((current) => ({ ...current, active: false }))
            }
          },
          { once: true },
        )
      } catch (error) {
        if (!disposed) {
          setState({
            supported: true,
            active: false,
            error:
              error instanceof Error
                ? `Screen wake lock unavailable: ${error.message}`
                : 'Screen wake lock is unavailable.',
          })
        }
      }
    }

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        (!sentinel || sentinel.released)
      ) {
        void requestLock()
      }
    }

    void requestLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
      if (sentinel && !sentinel.released) {
        void sentinel.release()
      }
    }
  }, [enabled])

  return {
    ...state,
    active: enabled && state.active,
    error: enabled ? state.error : null,
  }
}
