/**
 * Anton has no tabular figures, and its "1" is narrower than the other
 * digits. Setting each digit in an equal-width cell keeps a ticking
 * number from changing width, so nothing beside it moves.
 */
export function Digits({ text }: { text: string }) {
  return (
    <span className="digits" aria-hidden="true">
      {[...text].map((character, index) => (
        <span
          className={/\d/.test(character) ? 'digit' : 'digit-sep'}
          key={index}
        >
          {character}
        </span>
      ))}
    </span>
  )
}
