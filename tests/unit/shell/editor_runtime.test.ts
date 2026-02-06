import { describe, it, expect, vi } from 'vitest'
import { create_editor_runtime } from '$lib/shell/editor_runtime'
import type { EditorPort, EditorHandle } from '$lib/ports/editor_port'
import type { OpenNoteState } from '$lib/types/editor'
import type { AppEvent } from '$lib/events/app_event'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

function create_note(id: string, markdown: string): OpenNoteState {
  const note_id = as_note_path(`${id}.md`)
  return {
    meta: {
      id: note_id,
      path: note_id,
      title: id,
      mtime_ms: 0,
      size_bytes: markdown.length
    },
    markdown: as_markdown_text(markdown),
    buffer_id: note_id,
    is_dirty: false
  }
}

describe('create_editor_runtime', () => {
  it('emits events and delegates to handle', async () => {
    const events: AppEvent[] = []
    let captured_config: Parameters<EditorPort['create_editor']>[1] | undefined

    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn().mockReturnValue('latest'),
      insert_text_at_cursor: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }

    const editor_port: EditorPort = {
      create_editor: (_root, config) => {
        captured_config = config
        return Promise.resolve(handle)
      }
    }

    const runtime = create_editor_runtime({
      editor: editor_port,
      emit_event: (event) => {
        events.push(event)
      },
      resolve_asset_url: undefined
    })

    const note = create_note('note-1', 'hello')
    await runtime.mount({
      root: {} as HTMLDivElement,
      note,
      link_syntax: 'wikilink'
    })

    const config = captured_config
    if (!config) {
      throw new Error('Editor config was not captured')
    }

    config.on_markdown_change('updated')
    config.on_dirty_state_change(true)

    expect(events).toContainEqual({
      type: 'editor_markdown_changed',
      note_id: note.meta.id,
      markdown: as_markdown_text('updated')
    })
    expect(events).toContainEqual({
      type: 'editor_dirty_changed',
      note_id: note.meta.id,
      is_dirty: true
    })

    runtime.insert_text('hi')
    expect(handle.insert_text_at_cursor).toHaveBeenCalledWith('hi')

    runtime.mark_clean()
    expect(handle.mark_clean).toHaveBeenCalled()

    const flushed = runtime.flush()
    expect(flushed).toEqual({
      note_id: note.meta.id,
      markdown: as_markdown_text('latest')
    })
    expect(events).toContainEqual({
      type: 'editor_markdown_changed',
      note_id: note.meta.id,
      markdown: as_markdown_text('latest')
    })
    expect(events).toContainEqual({
      type: 'editor_flushed',
      note_id: note.meta.id,
      markdown: as_markdown_text('latest')
    })
  })

  it('emits editor_cursor_changed when cursor changes', async () => {
    const events: AppEvent[] = []
    let captured_config: Parameters<EditorPort['create_editor']>[1] | undefined

    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn().mockReturnValue(''),
      insert_text_at_cursor: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }

    const editor_port: EditorPort = {
      create_editor: (_root, config) => {
        captured_config = config
        return Promise.resolve(handle)
      }
    }

    const runtime = create_editor_runtime({
      editor: editor_port,
      emit_event: (event) => { events.push(event) },
      resolve_asset_url: undefined
    })

    const note = create_note('note-1', 'hello')
    await runtime.mount({
      root: {} as HTMLDivElement,
      note,
      link_syntax: 'wikilink'
    })

    captured_config?.on_cursor_change?.({ line: 5, column: 10, total_lines: 20 })

    expect(events).toContainEqual({
      type: 'editor_cursor_changed',
      note_id: note.meta.id,
      cursor: { line: 5, column: 10, total_lines: 20 }
    })
  })

  it('emits editor_wiki_link_clicked when wiki link is clicked', async () => {
    const events: AppEvent[] = []
    let captured_config: Parameters<EditorPort['create_editor']>[1] | undefined

    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn().mockReturnValue(''),
      insert_text_at_cursor: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }

    const editor_port: EditorPort = {
      create_editor: (_root, config) => {
        captured_config = config
        return Promise.resolve(handle)
      }
    }

    const runtime = create_editor_runtime({
      editor: editor_port,
      emit_event: (event) => { events.push(event) },
      resolve_asset_url: undefined
    })

    const note = create_note('note-1', 'hello')
    await runtime.mount({
      root: {} as HTMLDivElement,
      note,
      link_syntax: 'wikilink'
    })

    captured_config?.on_wiki_link_click?.('some-note.md')

    expect(events).toContainEqual({
      type: 'editor_wiki_link_clicked',
      note_path: 'some-note.md'
    })
  })
})
