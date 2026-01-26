import { Editor, commandsCtx, defaultValueCtx, editorViewCtx, parserCtx, rootCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import {
  createCodeBlockCommand,
  imageSchema,
  toggleEmphasisCommand,
  toggleLinkCommand,
  toggleStrongCommand
} from '@milkdown/kit/preset/commonmark'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { $view } from '@milkdown/kit/utils'
import { codeBlockComponent } from '@milkdown/components/code-block'
import { configure_codemirror_codeblocks } from '$lib/adapters/editor/codemirror_codeblock_nodeview'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history'
import { EditorState, type Transaction } from '@milkdown/kit/prose/state'
import { undoDepth } from '@milkdown/kit/prose/history'
import type { EditorView } from '@milkdown/kit/prose/view'

export type MilkdownHandle = {
  destroy: () => void
  set_markdown: (markdown: string) => void
  toggle_bold: () => void
  toggle_italic: () => void
  toggle_link: (href?: string) => void
  create_code_block: () => void
  insert_image: (args: { src: string; alt?: string }) => void
  undo: () => void
  redo: () => void
}

export async function create_milkdown_editor(
  root: HTMLElement,
  args: {
    initial_markdown: string
    on_markdown_change: (markdown: string) => void
    on_revision_change?: (args: { revision_id: number; sticky_dirty: boolean }) => void
    resolve_image_src?: (src: string) => string | null
  }
): Promise<MilkdownHandle> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, args.initial_markdown)
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prev) => {
        if (markdown === prev) return
        args.on_markdown_change(markdown)
      })
      configure_codemirror_codeblocks(ctx)
    })
    .use(
      $view(imageSchema.node, () => {
        return (node) => {
          const img = document.createElement('img')
          img.alt = node.attrs.alt ?? ''
          img.loading = 'lazy'
          img.decoding = 'async'
          img.style.maxWidth = '100%'
          img.style.borderRadius = '14px'
          img.style.boxShadow = '0 1px 0 hsl(var(--border)) inset'

          const src = String(node.attrs.src ?? '')
          img.src = args.resolve_image_src?.(src) ?? src

          return {
            dom: img,
            update: (updated) => {
              if (updated.type !== node.type) return false
              const next_src = String(updated.attrs.src ?? '')
              img.alt = updated.attrs.alt ?? ''
              img.src = args.resolve_image_src?.(next_src) ?? next_src
              return true
            }
          }
        }
      })
    )
    .config(nord)
    .use(commonmark)
    .use(gfm)
    .use(codeBlockComponent)
    .use(listener)
    .use(history)
    .create()

  let sticky_dirty = false

  function emit_revision(view: EditorView) {
    const revision_id = undoDepth(view.state)
    args.on_revision_change?.({ revision_id, sticky_dirty })
  }

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx) as unknown as EditorView
    const original_dispatch = view.props.dispatchTransaction

    view.setProps({
      dispatchTransaction: (tr: Transaction) => {
        const prev_revision_id = undoDepth(view.state)

        if (original_dispatch) original_dispatch(tr)
        else view.updateState(view.state.apply(tr))

        if (!tr.docChanged) return

        const next_revision_id = undoDepth(view.state)
        const add_to_history = tr.getMeta('addToHistory')
        const moved_in_history = next_revision_id !== prev_revision_id
        if (add_to_history === false && !moved_in_history) sticky_dirty = true

        emit_revision(view)
      }
    })

    emit_revision(view)
  })

  return {
    destroy: () => {
      editor.destroy()
    },
    set_markdown: (markdown: string) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const parser = ctx.get(parserCtx)
        const doc = parser(markdown)
        if (!doc) return

        const new_state = EditorState.create({
          doc,
          schema: view.state.schema,
          plugins: view.state.plugins
        })
        view.updateState(new_state)

        sticky_dirty = false
        emit_revision(view as unknown as EditorView)
      })
    },
    toggle_bold: () => {
      editor.action((ctx) => ctx.get(commandsCtx).call(toggleStrongCommand.key))
    },
    toggle_italic: () => {
      editor.action((ctx) => ctx.get(commandsCtx).call(toggleEmphasisCommand.key))
    },
    toggle_link: (href?: string) => {
      if (href) {
        editor.action((ctx) => ctx.get(commandsCtx).call(toggleLinkCommand.key, { href }))
        return
      }
      editor.action((ctx) => ctx.get(commandsCtx).call(toggleLinkCommand.key))
    },
    create_code_block: () => {
      editor.action((ctx) => ctx.get(commandsCtx).call(createCodeBlockCommand.key))
    },
    insert_image: ({ src, alt }) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const image_node = view.state.schema.nodes.image
        if (!image_node) {
          console.warn('Milkdown editor schema is missing the image node.')
          return
        }
        const node = image_node.create({ src, alt: alt ?? '' })
        view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
      })
    },
    undo: () => {
      editor.action((ctx) => ctx.get(commandsCtx).call(undoCommand.key))
    },
    redo: () => {
      editor.action((ctx) => ctx.get(commandsCtx).call(redoCommand.key))
    }
  }
}
