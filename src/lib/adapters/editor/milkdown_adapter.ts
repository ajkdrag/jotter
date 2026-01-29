import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx, editorViewCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listItemBlockComponent } from '@milkdown/kit/component/list-item-block'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { replaceAll } from '@milkdown/kit/utils'
import type { EditorPort } from '$lib/ports/editor_port'
import {
  dirty_state_plugin,
  dirty_state_plugin_config_key,
  dirty_state_plugin_key
} from './dirty_state_plugin'

export const milkdown_editor_port: EditorPort = {
  create_editor: async (root, config) => {
    const { initial_markdown, on_markdown_change, on_dirty_state_change } = config

    let current_markdown = initial_markdown
    let current_is_dirty = false
    let editor: Editor | null = null

    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initial_markdown)
        ctx.set(editorViewOptionsCtx, { editable: () => true })
      })
      .use(commonmark)
      .use(gfm)
      .use(listItemBlockComponent)
      .use(listener)
      .use(history)
      .use(dirty_state_plugin_config_key)
      .use(dirty_state_plugin)
      .config((ctx) => {
        ctx.set(dirty_state_plugin_config_key.key, {
          on_dirty_state_change: (is_dirty) => {
            current_is_dirty = is_dirty
            on_dirty_state_change(is_dirty)
          }
        })

        const listener_instance = ctx.get(listenerCtx)
        listener_instance.markdownUpdated((_ctx, markdown, prev_markdown) => {
          if (markdown !== prev_markdown && markdown !== current_markdown) {
            current_markdown = markdown
            on_markdown_change(markdown)
          }
        })
      })
      .create()

    function mark_clean() {
      if (!editor) return
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const tr = view.state.tr
        tr.setMeta(dirty_state_plugin_key, { action: 'mark_clean' })
        view.dispatch(tr)
      })
    }

    const handle = {
      destroy() {
        if (!editor) return
        editor.destroy()
        editor = null
      },
      set_markdown(markdown: string) {
        if (!editor) return
        current_markdown = markdown
        editor.action(replaceAll(markdown))
      },
      get_markdown() {
        return current_markdown
      },
      mark_clean,
      is_dirty() {
        return current_is_dirty
      },
      focus() {
        if (!editor) return
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          view.focus()
        })
      }
    }

    mark_clean()

    return handle
  }
}
