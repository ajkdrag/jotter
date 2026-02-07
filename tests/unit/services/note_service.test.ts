import { describe, expect, it, vi } from 'vitest'
import { NoteService } from '$lib/services/note_service'
import { VaultStore } from '$lib/stores/vault_store.svelte'
import { NotesStore } from '$lib/stores/notes_store.svelte'
import { EditorStore } from '$lib/stores/editor_store.svelte'
import { OpStore } from '$lib/stores/op_store.svelte'
import { as_asset_path, as_markdown_text, as_note_path } from '$lib/types/ids'
import { create_test_vault } from '../helpers/test_fixtures'
import { create_mock_index_port, create_mock_notes_port } from '../helpers/mock_ports'
import type { EditorService } from '$lib/services/editor_service'
import type { AssetsPort } from '$lib/ports/assets_port'

describe('NoteService', () => {
  it('opens note content and updates editor/ui state', async () => {
    const vault_store = new VaultStore()
    const notes_store = new NotesStore()
    const editor_store = new EditorStore()
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
    const assets_port = {
      resolve_asset_url: vi.fn(),
      write_image_asset: vi.fn()
    } as unknown as AssetsPort

    const editor_service = {
      flush: vi.fn().mockReturnValue(null),
      mark_clean: vi.fn()
    } as unknown as EditorService

    const service = new NoteService(
      notes_port,
      index_port,
      assets_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      editor_service,
      () => 1
    )

    const result = await service.open_note('docs/alpha.md', false)

    expect(editor_store.open_note?.meta.path).toBe(as_note_path('docs/alpha.md'))
    expect(editor_store.open_note?.markdown).toBe(as_markdown_text('# Alpha'))
    expect(result).toEqual({
      status: 'opened',
      selected_folder_path: 'docs'
    })
    expect(op_store.get('note.open:docs/alpha.md').status).toBe('success')
  })

  it('saves untitled note to a new path', async () => {
    const vault_store = new VaultStore()
    const notes_store = new NotesStore()
    const editor_store = new EditorStore()
    const op_store = new OpStore()

    vault_store.set_vault(create_test_vault())

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
    const assets_port = {
      resolve_asset_url: vi.fn(),
      write_image_asset: vi.fn()
    } as unknown as AssetsPort

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
      assets_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      editor_service,
      () => 1
    )

    const result = await service.save_note(as_note_path('docs/my-note.md'), false)

    const vault = vault_store.vault
    expect(vault).not.toBeNull()

    expect(notes_port._calls.create_note).toContainEqual({
      vault_id: vault?.id,
      note_path: as_note_path('docs/my-note.md'),
      markdown: as_markdown_text('draft')
    })
    expect(editor_store.open_note?.meta.path).toBe(as_note_path('docs/my-note.md'))
    expect(editor_store.open_note?.is_dirty).toBe(false)
    expect(result).toEqual({
      status: 'saved',
      saved_path: as_note_path('docs/my-note.md')
    })
    expect(op_store.get('note.save').status).toBe('success')
  })

  it('writes pasted image asset for active vault', async () => {
    const vault_store = new VaultStore()
    const notes_store = new NotesStore()
    const editor_store = new EditorStore()
    const op_store = new OpStore()

    vault_store.set_vault(create_test_vault())

    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const write_image_asset = vi.fn().mockResolvedValue(as_asset_path('docs/.assets/alpha-1.png'))
    const assets_port = {
      resolve_asset_url: vi.fn(),
      write_image_asset
    } as unknown as AssetsPort

    const editor_service = {
      flush: vi.fn().mockReturnValue(null),
      mark_clean: vi.fn()
    } as unknown as EditorService

    const service = new NoteService(
      notes_port,
      index_port,
      assets_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      editor_service,
      () => 1
    )

    const result = await service.save_pasted_image(as_note_path('docs/alpha.md'), {
      bytes: new Uint8Array([7, 8, 9]),
      mime_type: 'image/png',
      file_name: 'clip.png'
    })

    expect(write_image_asset).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      status: 'saved',
      asset_path: as_asset_path('docs/.assets/alpha-1.png')
    })
    expect(op_store.get('asset.write').status).toBe('success')
  })
})
