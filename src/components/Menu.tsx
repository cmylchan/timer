import { useEffect, useRef, useState } from 'react'
import type { IntervalTone } from '../types/workout'
import { CheckIcon, MoreIcon } from './Icons'

export interface MenuItem {
  label: string
  onSelect: () => void
  /** Set for radio items: whether this choice is the current one. */
  checked?: boolean
  danger?: boolean
  tone?: IntervalTone
}

interface MenuProps {
  label: string
  items: Array<MenuItem | 'separator'>
}

export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    rootRef.current
      ?.querySelector<HTMLElement>('[role^="menuitem"]')
      ?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', closeOutside)
    return () => window.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const options = [
      ...(rootRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ??
        []),
    ]
    const index = options.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      options[(index + step + options.length) % options.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      options[event.key === 'Home' ? 0 : options.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        className="icon-only"
        type="button"
        ref={buttonRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="menu-popover" role="menu" onKeyDown={handleKeyDown}>
          {items.map((item, index) =>
            item === 'separator' ? (
              <div className="menu-separator" role="separator" key={index} />
            ) : (
              <button
                className={`menu-item${item.danger ? ' is-danger' : ''}`}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                tabIndex={-1}
                key={item.label}
                onClick={() => {
                  close()
                  item.onSelect()
                }}
              >
                {item.tone && <i className="swatch" data-tone={item.tone} />}
                <span>{item.label}</span>
                {item.checked && <CheckIcon />}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
