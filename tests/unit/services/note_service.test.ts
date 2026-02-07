import { describe, expect, it, vi } from 'vitest'
import { NoteService } from '$lib/services/note_service'
import { VaultStore } from '$lib/stores/vault_store.svelte'
import { NotesStore } from '$lib/stores/notes_store.svelte'
import { EditorStore } from '$lib/stores/editor_store.svelte'
import { UIStore } from '$lib/stores/ui_store.svelte'
import { OpStore } from '$lib/stores/op_store.svelte'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import { create_test_vault } from '../helpers/test_fixtures'
import { create_mock_index_port, create_mock_notes_port } from '../helpers/mock_ports'
import type { EditorService } from '$lib/services/editor_service'

describe('NoteService', () => {
  it('opens note content and updates editor/ui state', async () => {
    const vault_store = new VaultStore()
    const notes_store = new NotesStore()
    const editor_store = new EditorStore()
    const ui_store = new UIStore()
    const op_store = new OpStore()

    vault_store.set_vault(create_test_vault())

    const note_meta = {
      id: as_note_path('docs/alpha.md'),
      path: as_note_path('docs/alpha.md'),
      title: 'alpha',
      mtime_ms: 0,
      size_bytes: 0
    }
    notes_store.set_notes([note_meta])

    const notes_port = create_mock_notes_port()
    notes_port.read_note = vi.fn().mockResolvedValue({
      meta: note_meta,
      markdown: as_markdown_text('# Alpha')
    })

    const index_port = create_mock_index_port()

    const editor_service = {
      flush: vi.fn().mockReturnValue(null),
      mark_clean: vi.fn()
    } as unknown as EditorService

    const service = new NoteService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      ui_store,
      op_store,
      editor_service,
      () => 1
    )

    await service.open_note('docs/alpha.md', false)

    expect(editor_store.open_note?.meta.path).toBe(as_note_path('docs/alpha.md'))
    expect(editor_store.open_note?.markdown).toBe(as_markdown_text('# Alpha'))
    expect(ui_store.selected_folder_path).toBe('docs')
    expect(op_store.get('note.open:docs/alpha.md').status).toBe('success')
  })

  it('saves untitled note to a new path', async () => {
    const vault_store = new VaultStore()
    const notes_store = new NotesStore()
    const editor_store = new EditorStore()
    const ui_store = new UIStore()
    const op_store = new OpStore()

    vault_store.set_vault(create_test_vault())
    ui_store.set_selected_folder_path('docs')

    editor_store.set_open_note({
      meta: {
        id: as_note_path('Untitled-1'),
        path: as_note_path('Untitled-1'),
        title: 'Untitled-1',
        mtime_ms: 0,
        size_bytes: 0
      },
      markdown: as_markdown_text('draft'),
      buffer_id: 'untitled-test',
      is_dirty: true
    })

    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()

    const editor_service = {
      flush: vi.fn().mockReturnValue({
        note_id: as_note_path('Untitled-1'),
        markdown: as_markdown_text('draft')
      }),
      mark_clean: vi.fn()
    } as unknown as EditorService

    const service = new NoteService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      ui_store,
      op_store,
      editor_service,
      () => 1
    )

    service.request_save()
    service.update_save_path('docs/my-note.md')
    await service.confirm_save()

    const vault = vault_store.vault
    expect(vault).not.toBeNull()

    expect(notes_port._calls.create_note).toContainEqual({
      vault_id: vault?.id,
      note_path: as_note_path('docs/my-note.md'),
      markdown: as_markdown_text('draft')
    })
    expect(editor_store.open_note?.meta.path).toBe(as_note_path('docs/my-note.md'))
    expect(editor_store.open_note?.is_dirty).toBe(false)
    expect(ui_store.save_note_dialog.open).toBe(false)
    expect(op_store.get('note.save').status).toBe('success')
  })
})
