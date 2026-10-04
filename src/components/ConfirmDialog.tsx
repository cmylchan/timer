import { useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previousFocus?.focus?.()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onCancel])

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <h2 className="dialog-title" id={titleId}>
          {title}
        </h2>
        <p className="confirm-body" id={bodyId}>
          {body}
        </p>
        <div className="dialog-actions">
          <button
            className="button button-quiet"
            type="button"
            ref={cancelRef}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`button ${danger ? 'button-danger' : 'button-heat'}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
