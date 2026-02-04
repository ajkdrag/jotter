import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import type { Node as ProseNode, Slice } from '@milkdown/kit/prose/model'
import { parserCtx } from '@milkdown/kit/core'
import { pick_paste_mode } from './markdown_paste_utils'

export const markdown_paste_plugin = $prose((ctx) => {
  const parser = ctx.get(parserCtx)

  return new Plugin({
    props: {
      handlePaste: (view, event) => {
        const editable = view.props.editable?.(view.state)
        const { clipboardData } = event
        if (!editable || !clipboardData) return false

        const current_node = view.state.selection.$from.node()
        if (current_node.type.spec.code) return false

        const text_markdown = clipboardData.getData('text/markdown')
        const text_plain = clipboardData.getData('text/plain')
        const text_html = clipboardData.getData('text/html')

        const mode = pick_paste_mode({ text_markdown, text_plain, text_html })
        if (mode !== 'markdown') return false

        const source = text_markdown.trim() !== '' ? text_markdown : text_plain
        const result = parser(source) as Slice | ProseNode | string | null | undefined
        if (!result || typeof result === 'string') return false

        if ('openStart' in result) {
          view.dispatch(view.state.tr.replaceSelection(result))
          return true
        }

        view.dispatch(view.state.tr.replaceSelectionWith(result, true))
        return true
      }
    }
  })
})
