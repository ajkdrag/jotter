export function count_words(text: string): number {
  let count = 0
  let in_word = false

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const is_space = code <= 32 || code === 160

    if (is_space) {
      in_word = false
      continue
    }

    if (!in_word) {
      count++
      in_word = true
    }
  }

  return count
}
