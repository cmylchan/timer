/** Em widths of the cells `Digits` sets numbers in. Match App.css. */
const DIGIT_EM = 0.5
const SEPARATOR_EM = 0.25

/** Width of `text` in em when set with `Digits`. */
export function digitsWidthEm(text: string) {
  return [...text].reduce(
    (width, character) =>
      width + (/\d/.test(character) ? DIGIT_EM : SEPARATOR_EM),
    0,
  )
}
