import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { linkSchema } from '@milkdown/kit/preset/commonmark'

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g
const ZERO_WIDTH_SPACE = '\u200B'

function find_link_range_before_cursor(
  state: import('@milkdown/kit/prose/state').EditorState,
  linkType: import('@milkdown/kit/prose/model').MarkType
): { from: number; to: number; href: string } | null {
  const { selection } = state
  if (!selection.empty) return null

  const pos = selection.$from
  if (pos.pos === 0) return null

  const resolved = state.doc.resolve(pos.pos - 1)
  const linkMark = resolved.marks().find(m => m.type === linkType)
  if (!linkMark) return null

  let from = pos.pos - 1
  let to = pos.pos

  while (from > 0) {
    const before = state.doc.resolve(from - 1)
    const hasSameLink = before.marks().some(
      m => m.type === linkType && m.attrs.href === linkMark.attrs.href
    )
    if (!hasSameLink) break
    from--
  }

  while (to < state.doc.content.size) {
    const after = state.doc.resolve(to)
    const hasSameLink = after.marks().some(
      m => m.type === linkType && m.attrs.href === linkMark.attrs.href
    )
    if (!hasSameLink) break
    to++
  }

  return { from, to, href: linkMark.attrs.href as string }
}

export const markdown_link_input_rule_plugin = $prose((ctx) => {
  const linkType = linkSchema.type(ctx)

  return new Plugin({
    key: new PluginKey('markdown-link-converter'),
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Backspace') return false

        const linkRange = find_link_range_before_cursor(view.state, linkType)
        if (!linkRange) return false

        const cursorPos = view.state.selection.from
        const { from, to } = linkRange
        const tr = view.state.tr.removeMark(from, to, linkType)
        tr.setSelection(TextSelection.create(tr.doc, cursorPos))
        view.dispatch(tr)
        return true
      }
    },
    appendTransaction(transactions, _oldState, newState) {
      const docChanged = transactions.some(tr => tr.docChanged)
      if (!docChanged) return null

      let tr = newState.tr
      let modified = false

      newState.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return true

        const hasLinkMark = node.marks.some(m => m.type === linkType)
        if (hasLinkMark) return true

        MARKDOWN_LINK_REGEX.lastIndex = 0
        const match = MARKDOWN_LINK_REGEX.exec(node.text)

        if (match) {
          const [fullMatch, linkText, href] = match
          if (!linkText || !href) return true

          const start = pos + match.index
          const end = start + fullMatch.length
          const linkMark = linkType.create({ href })

          const linkNode = newState.schema.text(linkText, [linkMark])
          const spaceNode = newState.schema.text(ZERO_WIDTH_SPACE)

          tr = tr.replaceWith(start, end, [linkNode, spaceNode])

          const cursorPos = start + linkText.length + 1
          tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos))
          tr = tr.setStoredMarks([])

          modified = true
          return false
        }

        return true
      })

      return modified ? tr : null
    }
  })
})
