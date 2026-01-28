import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'
import { keymap } from 'prosemirror-keymap'
import { history, undo, redo } from 'prosemirror-history'
import { baseKeymap } from 'prosemirror-commands'
import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { EditorPort } from '$lib/ports/editor_port'
import './prosemirror.css'

const schema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
  marks: basicSchema.spec.marks
})

function markdown_to_doc(markdown: string): ReturnType<typeof schema.node> {
  const parser = new MarkdownParser(
    schema,
    defaultMarkdownParser.tokenizer,
    defaultMarkdownParser.tokens
  )
  return parser.parse(markdown) || schema.node('doc', null, [schema.node('paragraph')])
}

function doc_to_markdown(doc: ReturnType<typeof schema.node>): string {
  const serializer = new MarkdownSerializer(
    defaultMarkdownSerializer.nodes,
    defaultMarkdownSerializer.marks
  )
  return serializer.serialize(doc)
}

export const prosemirror_editor_port: EditorPort = {
  create_editor: async (root, config) => {
    const { initial_markdown, on_markdown_change } = config

    const initial_doc = markdown_to_doc(initial_markdown)

    const state = EditorState.create({
      doc: initial_doc,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo }),
        keymap(baseKeymap)
      ]
    })

    let last_emitted_markdown = initial_markdown

    const view = new EditorView(root, {
      state,
      dispatchTransaction(transaction) {
        const new_state = view.state.apply(transaction)
        view.updateState(new_state)

        if (transaction.docChanged) {
          const markdown = doc_to_markdown(new_state.doc)
          if (markdown !== last_emitted_markdown) {
            last_emitted_markdown = markdown
            on_markdown_change(markdown)
          }
        }
      }
    })

    return {
      destroy: () => {
        view.destroy()
      },
      set_markdown: (markdown: string) => {
        const doc = markdown_to_doc(markdown)
        const new_state = EditorState.create({
          doc,
          schema: view.state.schema,
          plugins: view.state.plugins
        })
        view.updateState(new_state)
        last_emitted_markdown = markdown
      },
      get_markdown: () => {
        return doc_to_markdown(view.state.doc)
      }
    }
  }
}
