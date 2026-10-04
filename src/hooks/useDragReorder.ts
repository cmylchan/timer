import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * Reorders a list by dragging grip handles, or with the arrow keys while
 * a handle has focus. Listens on the window during a drag so the pointer
 * is not lost when the dragged row moves in the DOM.
 */
export function useDragReorder(
  ids: readonly string[],
  onMove: (from: number, to: number) => void,
) {
  const rows = useRef(new Map<string, HTMLElement>())
  const handles = useRef(new Map<string, HTMLElement>())
  const latest = useRef({ ids, onMove })
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useLayoutEffect(() => {
    latest.current = { ids, onMove }
  })

  useEffect(() => {
    if (draggingId === null) {
      return
    }
    const handleMove = (event: PointerEvent) => {
      const { ids: order, onMove: move } = latest.current
      const from = order.indexOf(draggingId)
      if (from < 0) {
        return
      }
      let to = from
      order.forEach((id, index) => {
        const rect = rows.current.get(id)?.getBoundingClientRect()
        if (!rect) {
          return
        }
        const middle = rect.top + rect.height / 2
        if (index < from && event.clientY < middle) {
          to = Math.min(to, index)
        } else if (index > from && event.clientY > middle) {
          to = Math.max(to, index)
        }
      })
      if (to !== from) {
        // Render now, so the next pointer move measures the new order.
        flushSync(() => move(from, to))
      }
    }
    const stop = () => setDraggingId(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    document.body.classList.add('is-reordering')
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.classList.remove('is-reordering')
    }
  }, [draggingId])

  const rowRef = (id: string) => (element: HTMLElement | null) => {
    if (element) {
      rows.current.set(id, element)
    } else {
      rows.current.delete(id)
    }
  }

  const handleProps = (id: string) => ({
    ref: (element: HTMLElement | null) => {
      if (element) {
        handles.current.set(id, element)
      } else {
        handles.current.delete(id)
      }
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) {
        return
      }
      event.preventDefault()
      setDraggingId(id)
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      const { ids: order, onMove: move } = latest.current
      const index = order.indexOf(id)
      const to =
        event.key === 'ArrowUp'
          ? index - 1
          : event.key === 'ArrowDown'
            ? index + 1
            : null
      if (to === null || to < 0 || to >= order.length) {
        return
      }
      event.preventDefault()
      flushSync(() => move(index, to))
      // Moving a focused node in the DOM drops its focus.
      handles.current.get(id)?.focus()
    },
  })

  return { draggingId, rowRef, handleProps }
}
