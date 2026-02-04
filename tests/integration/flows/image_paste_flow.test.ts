import { describe, expect, test, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { image_paste_flow_machine } from '$lib/flows/image_paste_flow'
import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { EditorPort } from '$lib/ports/editor_port'
import type { VaultId, NoteId, AssetPath } from '$lib/types/ids'
import type { ImagePasteData } from '$lib/types/image_paste'
import { create_mock_stores } from '../../unit/helpers/mock_stores'

function create_image_data(name: string): ImagePasteData {
  return {
    original_bytes: new Uint8Array([1, 2, 3]),
    original_name: name,
    mime_type: 'image/png',
    width: 100,
    height: 80
  }
}

describe('image_paste_flow', () => {
  test('enters configuring state on REQUEST_PASTE', () => {
    const assets_port: AssetsPort = {
      import_asset: vi.fn(),
      resolve_asset_url: vi.fn()
    }
    const editor_port: EditorPort = {
      insert_text_at_cursor: vi.fn(),
      create_editor: vi.fn()
    }
    const stores = create_mock_stores()

    const actor = createActor(image_paste_flow_machine, {
      input: { ports: { assets: assets_port, editor: editor_port }, stores }
    })
    actor.start()

    actor.send({
      type: 'REQUEST_PASTE',
      data: create_image_data('My File.png'),
      vault_id: 'vault-1' as VaultId,
      note_id: 'note-1.md' as NoteId,
      attachments_folder: '.assets'
    })

    expect(actor.getSnapshot().value).toBe('configuring')
    expect(actor.getSnapshot().context.custom_name).toBe('My File')
  })

  test('saves image and inserts markdown on confirm', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(7)

    const calls: { target_path: AssetPath }[] = []
    const assets_port: AssetsPort = {
      import_asset(_vault_id: VaultId, _source: AssetImportSource, target_path: AssetPath) {
        calls.push({ target_path })
        return Promise.resolve(target_path)
      },
      resolve_asset_url: vi.fn()
    }
    const editor_port: EditorPort = {
      insert_text_at_cursor: vi.fn(),
      create_editor: vi.fn()
    }
    const stores = create_mock_stores()

    const actor = createActor(image_paste_flow_machine, {
      input: { ports: { assets: assets_port, editor: editor_port }, stores }
    })
    actor.start()

    actor.send({
      type: 'REQUEST_PASTE',
      data: create_image_data('Example.png'),
      vault_id: 'vault-1' as VaultId,
      note_id: 'note-1.md' as NoteId,
      attachments_folder: '.assets'
    })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(calls[0]?.target_path).toBe('.assets/example-7.png')
    expect(editor_port.insert_text_at_cursor).toHaveBeenCalledWith('![Example](.assets/example-7.png)')
  })

  test('moves to error on failure and retries', async () => {
    let attempt = 0
    const assets_port: AssetsPort = {
      import_asset: vi.fn().mockImplementation(() => {
        attempt += 1
        if (attempt === 1) return Promise.reject(new Error('Disk full'))
        return Promise.resolve('.assets/image-1.png')
      }),
      resolve_asset_url: vi.fn()
    }
    const editor_port: EditorPort = {
      insert_text_at_cursor: vi.fn(),
      create_editor: vi.fn()
    }
    const stores = create_mock_stores()

    const actor = createActor(image_paste_flow_machine, {
      input: { ports: { assets: assets_port, editor: editor_port }, stores }
    })
    actor.start()

    actor.send({
      type: 'REQUEST_PASTE',
      data: create_image_data('Clipboard.png'),
      vault_id: 'vault-1' as VaultId,
      note_id: 'note-1.md' as NoteId,
      attachments_folder: '.assets'
    })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(editor_port.insert_text_at_cursor).toHaveBeenCalled()
  })
})
