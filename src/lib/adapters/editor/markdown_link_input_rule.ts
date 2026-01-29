import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { linkSchema } from '@milkdown/kit/preset/commonmark'

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/
const ZERO_WIDTH_SPACE = '\u200B'

export const markdown_link_input_rule_plugin = $prose((ctx) => {
  const linkType = linkSchema.type(ctx)

  return new Plugin({
    key: new PluginKey('markdown-link-converter'),
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null

      const tr = newState.tr
      let modified = false

      newState.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return true
        if (node.marks.some((m) => m.type === linkType)) return true

        const match = MARKDOWN_LINK_REGEX.exec(node.text)
        if (!match) return true

        const [fullMatch, linkText, href] = match
        if (!linkText || !href) return true

        const start = pos + match.index
        tr.replaceWith(start, start + fullMatch.length, [
          newState.schema.text(linkText, [linkType.create({ href })]),
          newState.schema.text(ZERO_WIDTH_SPACE)
        ])
          .setSelection(TextSelection.create(tr.doc, start + linkText.length + 1))
          .setStoredMarks([])

        modified = true
        return false
      })

      return modified ? tr : null
    }
  })
})
