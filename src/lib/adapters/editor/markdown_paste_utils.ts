type PasteMode = 'markdown' | 'html' | 'none'

type PasteModeInput = {
  text_markdown: string
  text_plain: string
  text_html: string
}

const HEADING_REGEX = /(^|\n)\s{0,3}#{1,6}\s+\S/
const LIST_REGEX = /(^|\n)\s{0,3}([-*+]|\d+\.)\s+\S/
const CODE_FENCE_REGEX = /(^|\n)\s{0,3}(```|~~~)/
const BLOCKQUOTE_REGEX = /(^|\n)\s{0,3}>\s+\S/
const LINK_REGEX = /\[[^\]]+\]\([^)]+\)/
const IMAGE_REGEX = /!\[[^\]]*]\([^)]+\)/
const INLINE_CODE_REGEX = /`[^`]+`/
const EMPHASIS_REGEX = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|__[^_]+__|_[^_\s][^_]*_)/

export function looks_like_markdown(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false

  return (
    HEADING_REGEX.test(trimmed) ||
    LIST_REGEX.test(trimmed) ||
    CODE_FENCE_REGEX.test(trimmed) ||
    BLOCKQUOTE_REGEX.test(trimmed) ||
    LINK_REGEX.test(trimmed) ||
    IMAGE_REGEX.test(trimmed) ||
    INLINE_CODE_REGEX.test(trimmed) ||
    EMPHASIS_REGEX.test(trimmed)
  )
}

export function pick_paste_mode(input: PasteModeInput): PasteMode {
  if (input.text_markdown.trim() !== '') return 'markdown'
  if (looks_like_markdown(input.text_plain)) return 'markdown'
  if (input.text_html.trim() !== '') return 'html'
  return 'none'
}
