import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx, editorViewCtx } from '@milkdown/kit/core'
import {
  configureLinkTooltip,
  linkTooltipPlugin,
  linkTooltipConfig,
} from '@milkdown/kit/component/link-tooltip'
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
import { markdown_link_input_rule_plugin } from './markdown_link_input_rule'

const LINK_TOOLTIP_ICONS = {
  link: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  edit: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
} as const

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
      .config(configureLinkTooltip)
      .config((ctx) => {
        ctx.update(linkTooltipConfig.key, (defaultConfig) => ({
          ...defaultConfig,
          linkIcon: LINK_TOOLTIP_ICONS.link,
          editButton: LINK_TOOLTIP_ICONS.edit,
          removeButton: LINK_TOOLTIP_ICONS.trash,
          confirmButton: LINK_TOOLTIP_ICONS.check,
          inputPlaceholder: 'Enter URL...',
        }))
      })
      .use(commonmark)
      .use(gfm)
      .use(linkTooltipPlugin)
      .use(listItemBlockComponent)
      .use(markdown_link_input_rule_plugin)
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
