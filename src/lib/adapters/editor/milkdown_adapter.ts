import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import type { CursorInfo } from '$lib/ports/editor_port'
import { Slice } from '@milkdown/kit/prose/model'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'
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
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { prism } from '@milkdown/plugin-prism'
import { indent } from '@milkdown/plugin-indent'
import { replaceAll } from '@milkdown/kit/utils'
import { Link, Pencil, Trash2, Check } from 'lucide-static'
import type { EditorPort } from '$lib/ports/editor_port'
import {
  dirty_state_plugin,
  dirty_state_plugin_config_key,
  dirty_state_plugin_key
} from './dirty_state_plugin'
import { markdown_link_input_rule_plugin } from './markdown_link_input_rule'
import { markdown_paste_plugin } from './markdown_paste_plugin'
import { create_image_paste_plugin } from './image_paste_plugin'
import { create_asset_image_plugin } from './asset_image_plugin'
import { create_wiki_link_click_plugin, create_wiki_link_converter_plugin, wiki_link_plugin_key } from './wiki_link_plugin'
import { format_wiki_target_for_markdown, format_wiki_target_for_markdown_link, try_decode_wiki_link_href } from '$lib/utils/wiki_link'

function resize_icon(svg: string, size: number): string {
  return svg
    .replace(/width="24"/, `width="${String(size)}"`)
    .replace(/height="24"/, `height="${String(size)}"`)
}

const LINK_TOOLTIP_ICONS = {
  link: resize_icon(Link, 16),
  edit: resize_icon(Pencil, 14),
  trash: resize_icon(Trash2, 14),
  check: resize_icon(Check, 14),
} as const

const LARGE_DOC_LINE_THRESHOLD = 8000
const LARGE_DOC_CHAR_THRESHOLD = 400_000

function count_lines(text: string): number {
  if (text === '') return 1

  let lines = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++
  }
  return lines
}

function is_large_markdown(text: string): boolean {
  if (text.length >= LARGE_DOC_CHAR_THRESHOLD) return true
  return count_lines(text) >= LARGE_DOC_LINE_THRESHOLD
}

function calculate_cursor_info(doc: ProseNode, selection: Selection | null | undefined): CursorInfo {
  const $from = selection?.$from
  if (!$from) return { line: 1, column: 1, total_lines: doc.childCount || 1 }

  const line = $from.index(0) + 1
  const column = $from.parentOffset + 1
  const total_lines = doc.childCount || 1
  return { line, column, total_lines }
}

const cursor_plugin_key = new PluginKey('cursor-tracker')

function create_cursor_plugin(on_cursor_change: (info: CursorInfo) => void) {
  return $prose(() => new Plugin({
    key: cursor_plugin_key,
    view: () => ({
      update: (view) => {
        const { doc, selection } = view.state
        const info = calculate_cursor_info(doc, selection)
        on_cursor_change(info)
      }
    })
  }))
}

let active_editor: Editor | null = null

export const milkdown_editor_port: EditorPort = {
  insert_text_at_cursor: (text: string) => {
    if (!active_editor) {
      console.warn('[milkdown_adapter] insert_text_at_cursor called with no active editor')
      return
    }
    active_editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      try {
        const parser = ctx.get(parserCtx)
        const doc = parser(text)
        const tr = state.tr.replaceSelection(new Slice(doc.content, 0, 0))
        view.dispatch(tr)
        view.focus()
      } catch (error) {
        console.error('Failed to insert markdown at cursor:', error)
        const tr = state.tr.insertText(text, state.selection.from, state.selection.to)
        view.dispatch(tr)
        view.focus()
      }
    })
  },
  create_editor: async (root, config) => {
    const { initial_markdown, note_path, link_syntax, resolve_asset_url, on_markdown_change, on_dirty_state_change, on_cursor_change, on_wiki_link_click } = config

    let current_markdown = initial_markdown
    let current_is_dirty = false
    let editor: Editor | null = null
    let is_large_note = is_large_markdown(initial_markdown)

    function normalize_markdown(raw: string): string {
      const needs_zws_cleanup = raw.includes('\u200B')
      const needs_wiki_cleanup = raw.includes('jotter://wiki')
      if (!needs_zws_cleanup && !needs_wiki_cleanup) return raw

      const without_zws = needs_zws_cleanup ? raw.replaceAll('\u200B', '') : raw
      if (!needs_wiki_cleanup) return without_zws

      return without_zws.replace(/\[([^\]]+)\]\((jotter:\/\/wiki\/?\?[^)\s]+)\)/g, (full, label, href) => {
        const resolved_note_path = try_decode_wiki_link_href(String(href))
        if (!resolved_note_path) return full

        const safe_label = String(label)
        if (link_syntax === 'markdown') {
          const target = format_wiki_target_for_markdown_link({
            base_note_path: note_path,
            resolved_note_path
          })

          return `[${safe_label}](${target})`
        }

        const target = format_wiki_target_for_markdown({
          base_note_path: note_path,
          resolved_note_path
        })

        if (safe_label === target) return `[[${target}]]`
        return `[[${target}|${safe_label}]]`
      })
    }

    let builder = Editor.make()
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
      .use(prism)
      .use(indent)
      .use(linkTooltipPlugin)
      .use(listItemBlockComponent)
      .use(markdown_link_input_rule_plugin)
      .use(create_wiki_link_converter_plugin(note_path))
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
          if (markdown === prev_markdown) return

          const normalized = normalize_markdown(markdown)
          if (normalized === current_markdown) return

          current_markdown = normalized
          on_markdown_change(normalized)
        })
      })

    if (config.on_image_paste) {
      builder = builder.use(create_image_paste_plugin(config.on_image_paste))
    }

    if (resolve_asset_url) {
      builder = builder.use(create_asset_image_plugin(resolve_asset_url))
    }

    builder = builder.use(markdown_paste_plugin).use(clipboard)

    if (on_wiki_link_click) {
      builder = builder.use(create_wiki_link_click_plugin(note_path, on_wiki_link_click))
    }

    if (on_cursor_change) {
      builder = builder.use(create_cursor_plugin(on_cursor_change))
    }

    editor = await builder.create()
    active_editor = editor

    if (!is_large_note) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const tr = view.state.tr.setMeta(wiki_link_plugin_key, { action: 'full_scan' })
        view.dispatch(tr)
      })
    }

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
        if (editor === active_editor) {
          active_editor = null
        }
        void editor.destroy()
        editor = null
      },
      set_markdown(markdown: string) {
        if (!editor) return
        is_large_note = is_large_markdown(markdown)
        current_markdown = markdown
        editor.action(replaceAll(markdown))
        if (!is_large_note) {
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx)
            const tr = view.state.tr.setMeta(wiki_link_plugin_key, { action: 'full_scan' })
            view.dispatch(tr)
          })
        }
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
