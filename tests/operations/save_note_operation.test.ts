import { describe, it, expect } from 'vitest'
import { save_note_with_untitled_handling } from '$lib/operations/save_note_operation'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_id, as_note_path, as_markdown_text } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'

describe('save_note_with_untitled_handling', () => {
  it('creates new note when path does not end with .md', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const untitled_note: OpenNoteState = {
      meta: {
        id: as_note_path('untitled'),
        path: as_note_path('untitled'),
        title: 'untitled',
        mtime_ms: Date.now(),
        size_bytes: 0
      },
      markdown: as_markdown_text('# Hello'),
      buffer_id: 'untitled',
      is_dirty: true
    }

    const result = await save_note_with_untitled_handling(
      { notes: ports.notes },
      { vault_id, note: untitled_note }
    )

    expect(result.needs_path_update).toBe(true)
    expect(result.final_note_id).toBe('untitled.md')
  })

  it('writes to existing note when path ends with .md', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const titled_note: OpenNoteState = {
      meta: {
        id: as_note_path('existing.md'),
        path: as_note_path('existing.md'),
        title: 'existing',
        mtime_ms: Date.now(),
        size_bytes: 0
      },
      markdown: as_markdown_text('# Updated'),
      buffer_id: 'existing.md',
      is_dirty: true
    }

    const result = await save_note_with_untitled_handling(
      { notes: ports.notes },
      { vault_id, note: titled_note }
    )

    expect(result.needs_path_update).toBe(false)
    expect(result.final_note_id).toBe('existing.md')
  })
})
