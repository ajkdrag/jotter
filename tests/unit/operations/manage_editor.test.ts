import { describe, it, expect, vi } from 'vitest'
import { create_editor_manager } from '$lib/operations/manage_editor'
import type { EditorPort, EditorHandle } from '$lib/ports/editor_port'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'

function create_note(buffer_id: string, markdown: string): OpenNoteState {
  return {
    meta: {
      id: as_note_path(`${buffer_id}.md`),
      path: as_note_path(`${buffer_id}.md`),
      title: buffer_id,
      mtime_ms: 0,
      size_bytes: markdown.length
    },
    markdown: as_markdown_text(markdown),
    buffer_id,
    is_dirty: false
  }
}

describe('create_editor_manager', () => {
  it('mount creates editor and replaces existing handle', async () => {
    const first_handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }
    const second_handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }
    const editor_port: EditorPort = {
      create_editor: vi.fn()
        .mockResolvedValueOnce(first_handle)
        .mockResolvedValueOnce(second_handle)
    }

    const manager = create_editor_manager(editor_port)

    await manager.mount({} as HTMLElement, create_note('a', 'first'), vi.fn(), vi.fn(), 'wikilink')
    await manager.mount({} as HTMLElement, create_note('b', 'second'), vi.fn(), vi.fn(), 'wikilink')

    expect(editor_port.create_editor).toHaveBeenCalledTimes(2)
    expect(first_handle.destroy).toHaveBeenCalledTimes(1)
  })

  it('update does nothing when buffer id unchanged', async () => {
    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }
    const editor_port: EditorPort = {
      create_editor: vi.fn().mockResolvedValue(handle)
    }

    const manager = create_editor_manager(editor_port)
    await manager.mount({} as HTMLElement, create_note('a', 'first'), vi.fn(), vi.fn(), 'wikilink')
    manager.update(create_note('a', 'first'))

    expect(handle.set_markdown).not.toHaveBeenCalled()
    expect(handle.mark_clean).not.toHaveBeenCalled()
  })

  it('update switches content on buffer change', async () => {
    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }
    const editor_port: EditorPort = {
      create_editor: vi.fn().mockResolvedValue(handle)
    }

    const manager = create_editor_manager(editor_port)
    await manager.mount({} as HTMLElement, create_note('a', 'first'), vi.fn(), vi.fn(), 'wikilink')
    manager.update(create_note('b', 'second'))

    expect(handle.set_markdown).toHaveBeenCalledWith(as_markdown_text('second'))
    expect(handle.mark_clean).toHaveBeenCalled()
  })

  it('destroy clears handle and buffer state', async () => {
    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }
    const editor_port: EditorPort = {
      create_editor: vi.fn().mockResolvedValue(handle)
    }

    const manager = create_editor_manager(editor_port)
    await manager.mount({} as HTMLElement, create_note('a', 'first'), vi.fn(), vi.fn(), 'wikilink')
    manager.destroy()
    manager.destroy()

    expect(handle.destroy).toHaveBeenCalledTimes(1)
  })

  it('mark_clean and focus delegate to handle', async () => {
    const handle: EditorHandle = {
      destroy: vi.fn(),
      set_markdown: vi.fn(),
      get_markdown: vi.fn(),
      mark_clean: vi.fn(),
      is_dirty: vi.fn(),
      focus: vi.fn()
    }
    const editor_port: EditorPort = {
      create_editor: vi.fn().mockResolvedValue(handle)
    }

    const manager = create_editor_manager(editor_port)
    await manager.mount({} as HTMLElement, create_note('a', 'first'), vi.fn(), vi.fn(), 'wikilink')
    manager.mark_clean()
    manager.focus()

    expect(handle.mark_clean).toHaveBeenCalledTimes(1)
    expect(handle.focus).toHaveBeenCalledTimes(1)
  })
})
