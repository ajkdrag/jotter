import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { linkSchema } from '@milkdown/kit/preset/commonmark'

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g
const ZERO_WIDTH_SPACE = '\u200B'

export const markdown_link_input_rule_plugin = $prose((ctx) => {
  const linkType = linkSchema.type(ctx)

  return new Plugin({
    key: new PluginKey('markdown-link-converter'),
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
