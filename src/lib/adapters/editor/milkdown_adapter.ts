import { Editor, commandsCtx, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
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
import { nord } from '@milkdown/theme-nord'
import { codeBlockComponent } from '@milkdown/components/code-block'
import { configure_codemirror_codeblocks } from '$lib/adapters/editor/codemirror_codeblock_nodeview'

export type MilkdownHandle = {
  destroy: () => void
  toggle_bold: () => void
  toggle_italic: () => void
  toggle_link: (href?: string) => void
  create_code_block: () => void
  insert_image: (args: { src: string; alt?: string }) => void
}

export async function create_milkdown_editor(
  root: HTMLElement,
  args: {
    initial_markdown: string
    on_markdown_change: (markdown: string) => void
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
    .config(nord)
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
    .use(commonmark)
    .use(gfm)
    .use(codeBlockComponent)
    .use(listener)
    .create()

  return {
    destroy: () => {
      editor.destroy()
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
    }
  }
}
