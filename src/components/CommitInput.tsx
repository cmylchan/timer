import { useState, type InputHTMLAttributes } from 'react'

interface CommitInputProps<T>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: T
  format: (value: T) => string
  /** Returns `undefined` while the text is not a valid value. */
  parse: (text: string) => T | undefined
  onCommit: (value: T) => void
  invalid?: boolean
}

/**
 * A text input for a typed value, such as "25:00" or a weight. Valid
 * text is committed as it is typed; on blur the input shows the last
 * committed value in its standard format.
 */
export function CommitInput<T>({
  value,
  format,
  parse,
  onCommit,
  invalid = false,
  onFocus,
  onBlur,
  ...props
}: CommitInputProps<T>) {
  const [draft, setDraft] = useState<string | null>(null)
  const draftInvalid = draft !== null && parse(draft) === undefined

  return (
    <input
      {...props}
      value={draft ?? format(value)}
      aria-invalid={invalid || draftInvalid || undefined}
      onFocus={(event) => {
        setDraft(format(value))
        onFocus?.(event)
      }}
      onChange={(event) => {
        setDraft(event.target.value)
        const parsed = parse(event.target.value)
        if (parsed !== undefined) {
          onCommit(parsed)
        }
      }}
      onBlur={(event) => {
        setDraft(null)
        onBlur?.(event)
      }}
    />
  )
}
