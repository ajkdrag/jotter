import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'
import { imageBlockSchema } from '@milkdown/kit/component/image-block'
import type { Node as ProseNode, NodeType } from '@milkdown/kit/prose/model'

const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^)\s]+)\)/

export const image_input_rule_plugin = $prose((ctx) => {
  const image_block_type = imageBlockSchema.node.type(ctx)

  return new Plugin({
    key: new PluginKey('image-block-converter'),
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null

      const { $from } = newState.selection
      const parent = $from.parent
      if (!parent.isTextblock) return null

      const para_pos = $from.before()

      const inline_image = find_solo_inline_image(parent)
      if (inline_image) {
        return replace_paragraph_with_image_block(
          newState, para_pos, parent.nodeSize, String(inline_image.attrs.src), image_block_type
        )
      }

      const text_match = find_solo_image_text(parent, $from.parentOffset)
      if (text_match) {
        return replace_paragraph_with_image_block(
          newState, para_pos, parent.nodeSize, text_match.src, image_block_type
        )
      }

      return null
    }
  })
})

function find_solo_inline_image(parent: ProseNode): ProseNode | null {
  if (parent.childCount !== 1) return null
  const child = parent.child(0)
  return child.type.name === 'image' ? child : null
}

function collect_text(parent: ProseNode): string | null {
  const result = { text: '', has_non_text: false }

  parent.descendants((node: ProseNode) => {
    if (node.isText && node.text) {
      result.text += node.text
      return true
    }
    if (node.isInline) {
      result.has_non_text = true
      return false
    }
    return true
  })

  if (result.has_non_text || result.text.length === 0) return null
  return result.text
}

function find_solo_image_text(
  parent: ProseNode,
  anchor_offset: number
): { src: string } | null {
  const combined = collect_text(parent)
  if (!combined) return null

  const window_start = Math.max(0, anchor_offset - 256)
  const window_end = Math.min(combined.length, anchor_offset + 64)
  const window_text = combined.slice(window_start, window_end)

  const match = IMAGE_MARKDOWN_REGEX.exec(window_text)
  if (!match) return null

  const [full_match, , src] = match
  if (!src) return null

  const match_start = window_start + match.index
  const match_end = match_start + full_match.length

  const has_text_before = combined.slice(0, match_start).trim() !== ''
  const has_text_after = combined.slice(match_end).trim() !== ''
  if (has_text_before || has_text_after) return null

  return { src }
}

function replace_paragraph_with_image_block(
  state: EditorState,
  para_pos: number,
  para_size: number,
  src: string,
  image_block_type: NodeType
): Transaction {
  const tr = state.tr
  const para_end = para_pos + para_size
  const new_node = image_block_type.create({ src, caption: '', ratio: 1 })

  tr.replaceWith(para_pos, para_end, new_node)

  const after_pos = para_pos + new_node.nodeSize
  const paragraph_type = state.schema.nodes.paragraph
  if (after_pos >= tr.doc.content.size && paragraph_type) {
    tr.insert(after_pos, paragraph_type.create())
  }

  tr.setSelection(TextSelection.near(tr.doc.resolve(after_pos), 1))
  return tr
}
