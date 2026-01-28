import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { replaceAll } from '@milkdown/kit/utils'
import type { EditorPort } from '$lib/ports/editor_port'
import '@milkdown/theme-nord/style.css'

export const milkdown_editor_port: EditorPort = {
  create_editor: async (root, config) => {
    const { initial_markdown, on_markdown_change } = config

    let current_markdown = initial_markdown
    let editor: Editor | null = null

    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initial_markdown)
        ctx.set(editorViewOptionsCtx, { editable: () => true })

        const listener_instance = ctx.get(listenerCtx)
        listener_instance.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown && markdown !== current_markdown) {
            current_markdown = markdown
            on_markdown_change(markdown)
          }
        })
      })
      .config(nord)
      .use(commonmark)
      .use(listener)
      .use(history)
      .create()

    return {
      destroy: () => {
        if (editor) {
          editor.destroy()
          editor = null
        }
      },
      set_markdown: (markdown: string) => {
        if (editor) {
          current_markdown = markdown
          editor.action(replaceAll(markdown))
        }
      },
      get_markdown: () => {
        return current_markdown
      },
    }
  },
}
