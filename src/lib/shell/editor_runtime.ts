import type { EditorPort, EditorHandle } from '$lib/ports/editor_port'
import type { OpenNoteState, CursorInfo } from '$lib/types/editor'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { AssetPath, MarkdownText, NoteId } from '$lib/types/ids'
import { as_markdown_text } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'

export type EditorFlushResult = {
  note_id: NoteId
  markdown: MarkdownText
}

export type EditorRuntime = {
  mount: (args: {
    root: HTMLDivElement
    note: OpenNoteState
    link_syntax: EditorSettings['link_syntax']
  }) => Promise<void>
  unmount: () => void
  open_buffer: (note: OpenNoteState, link_syntax: EditorSettings['link_syntax']) => Promise<void>
  apply_settings: (settings: EditorSettings) => Promise<void>
  insert_text: (text: string) => void
  mark_clean: () => void
  flush: () => EditorFlushResult | null
  focus: () => void
}

export function create_editor_runtime(input: {
  editor: EditorPort
  emit_event: (event: AppEvent) => void
  resolve_asset_url: ((asset_path: AssetPath) => Promise<string>) | undefined
}): EditorRuntime {
  let handle: EditorHandle | null = null
  let root: HTMLDivElement | null = null
  let current_note: OpenNoteState | null = null
  let current_link_syntax: EditorSettings['link_syntax'] = 'wikilink'

  const emit_editor_markdown = (note_id: NoteId, markdown: string) => {
    input.emit_event({
      type: 'editor_markdown_changed',
      note_id,
      markdown: as_markdown_text(markdown)
    })
  }

  const emit_editor_dirty = (note_id: NoteId, is_dirty: boolean) => {
    input.emit_event({
      type: 'editor_dirty_changed',
      note_id,
      is_dirty
    })
  }

  const emit_cursor_changed = (note_id: NoteId, cursor: CursorInfo) => {
    input.emit_event({
      type: 'editor_cursor_changed',
      note_id,
      cursor
    })
  }

  const emit_wiki_link_clicked = (note_path: string) => {
    input.emit_event({
      type: 'editor_wiki_link_clicked',
      note_path
    })
  }

  const mount = async (args: {
    root: HTMLDivElement
    note: OpenNoteState
    link_syntax: EditorSettings['link_syntax']
  }) => {
    if (handle) {
      handle.destroy()
      handle = null
    }

    root = args.root
    current_note = args.note
    current_link_syntax = args.link_syntax

    const config = {
      initial_markdown: args.note.markdown,
      note_path: args.note.meta.path,
      link_syntax: args.link_syntax,
      on_markdown_change: (markdown: string) => {
        if (!current_note) return
        emit_editor_markdown(current_note.meta.id, markdown)
      },
      on_dirty_state_change: (is_dirty: boolean) => {
        if (!current_note) return
        emit_editor_dirty(current_note.meta.id, is_dirty)
      },
      on_cursor_change: (cursor: CursorInfo) => {
        if (!current_note) return
        emit_cursor_changed(current_note.meta.id, cursor)
      },
      on_wiki_link_click: (note_path: string) => {
        emit_wiki_link_clicked(note_path)
      }
    } as const

    handle = await input.editor.create_editor(args.root, {
      ...config,
      ...(input.resolve_asset_url ? { resolve_asset_url: input.resolve_asset_url } : {})
    })
  }

  const open_buffer = async (note: OpenNoteState, link_syntax: EditorSettings['link_syntax']) => {
    if (!root) return
    await mount({ root, note, link_syntax })
  }

  const apply_settings = async (settings: EditorSettings) => {
    current_link_syntax = settings.link_syntax
    if (!current_note) return
    if (!root) return
    await open_buffer(current_note, current_link_syntax)
  }

  const insert_text = (text: string) => {
    handle?.insert_text_at_cursor(text)
  }

  const mark_clean = () => {
    handle?.mark_clean()
  }

  const flush = (): EditorFlushResult | null => {
    if (!handle || !current_note) return null
    const markdown = handle.get_markdown()
    const payload = {
      note_id: current_note.meta.id,
      markdown: as_markdown_text(markdown)
    } as const
    emit_editor_markdown(payload.note_id, markdown)
    input.emit_event({
      type: 'editor_flushed',
      note_id: payload.note_id,
      markdown: payload.markdown
    })
    return payload
  }

  const focus = () => {
    handle?.focus()
  }

  const unmount = () => {
    if (handle) {
      handle.destroy()
      handle = null
    }
    root = null
    current_note = null
  }

  return {
    mount,
    unmount,
    open_buffer,
    apply_settings,
    insert_text,
    mark_clean,
    flush,
    focus
  }
}
