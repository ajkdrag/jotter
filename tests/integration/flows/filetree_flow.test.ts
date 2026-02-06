import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { filetree_flow_machine } from '$lib/flows/filetree_flow'
import type { VaultId } from '$lib/types/ids'
import type { FolderContents } from '$lib/types/filetree'

function create_mock_input() {
  const get_vault_id = vi.fn(() => 'test-vault' as VaultId)
  const get_vault_generation = vi.fn(() => 0)
  const dispatch_many = vi.fn()
  const list_folder_contents = vi.fn(
    (_vault_id: VaultId, _folder_path: string): Promise<FolderContents> => Promise.resolve({
      notes: [],
      subfolders: []
    })
  )

  return {
    ports: {
      notes: {
        list_folder_contents,
        list_notes: vi.fn(),
        list_folders: vi.fn(),
        read_note: vi.fn(),
        write_note: vi.fn(),
        create_note: vi.fn(),
        delete_note: vi.fn(),
        rename_note: vi.fn(),
        create_folder: vi.fn(),
        rename_folder: vi.fn(),
        delete_folder: vi.fn(() => Promise.resolve({ deleted_notes: [], deleted_folders: [] })),
        get_folder_stats: vi.fn(() => Promise.resolve({ note_count: 0, folder_count: 0 }))
      }
    },
    get_vault_id,
    get_vault_generation,
    dispatch_many
  }
}

describe('filetree_flow', () => {
  it('starts with empty state', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()
    const snapshot = actor.getSnapshot()

    expect(snapshot.context.expanded_paths.size).toBe(0)
    expect(snapshot.context.load_states.size).toBe(0)
    expect(snapshot.context.error_messages.size).toBe(0)
    expect(snapshot.context.active_loads.size).toBe(0)

    actor.stop()
  })

  it('expands folder and marks for loading on TOGGLE_FOLDER', async () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'documents' })

    await waitFor(actor, () => actor.getSnapshot().context.load_states.get('documents') === 'loaded')

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.expanded_paths.has('documents')).toBe(true)
    expect(snapshot.context.load_states.get('documents')).toBe('loaded')
    expect(snapshot.context.active_loads.has('documents')).toBe(false)

    actor.stop()
  })

  it('collapses folder on second TOGGLE_FOLDER', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'documents' })
    actor.send({ type: 'TOGGLE_FOLDER', path: 'documents' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.expanded_paths.has('documents')).toBe(false)

    actor.stop()
  })

  it('transitions to loaded state on FOLDER_LOAD_DONE', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({
      type: 'FOLDER_LOAD_DONE',
      path: 'docs',
      generation: 0,
      events: []
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.load_states.get('docs')).toBe('loaded')
    expect(snapshot.context.active_loads.has('docs')).toBe(false)

    actor.stop()
  })

  it('transitions to error state on FOLDER_LOAD_ERROR', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({
      type: 'FOLDER_LOAD_ERROR',
      path: 'docs',
      generation: 0,
      error: 'Network error'
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.load_states.get('docs')).toBe('error')
    expect(snapshot.context.error_messages.get('docs')).toBe('Network error')
    expect(snapshot.context.active_loads.has('docs')).toBe(false)

    actor.stop()
  })

  it('retries loading on RETRY_LOAD', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({
      type: 'FOLDER_LOAD_ERROR',
      path: 'docs',
      generation: 0,
      error: 'Network error'
    })
    actor.send({ type: 'RETRY_LOAD', path: 'docs' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.load_states.get('docs')).toBe('loading')
    expect(snapshot.context.active_loads.has('docs')).toBe(true)

    actor.stop()
  })

  it('collapses all folders on COLLAPSE_ALL', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'a' })
    actor.send({ type: 'TOGGLE_FOLDER', path: 'b' })
    actor.send({ type: 'COLLAPSE_ALL' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.expanded_paths.size).toBe(0)

    actor.stop()
  })

  it('resets all state on RESET', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({
      type: 'FOLDER_LOAD_ERROR',
      path: 'docs',
      generation: 0,
      error: 'Error'
    })
    actor.send({ type: 'RESET' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.expanded_paths.size).toBe(0)
    expect(snapshot.context.load_states.size).toBe(0)
    expect(snapshot.context.error_messages.size).toBe(0)
    expect(snapshot.context.active_loads.size).toBe(0)

    actor.stop()
  })

  it('does not re-trigger loading for already loaded folders', () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({
      type: 'FOLDER_LOAD_DONE',
      path: 'docs',
      generation: 0,
      events: []
    })

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.load_states.get('docs')).toBe('loaded')
    expect(snapshot.context.active_loads.has('docs')).toBe(false)

    actor.stop()
  })

  it('resets and loads root on VAULT_CHANGED', async () => {
    const actor = createActor(filetree_flow_machine, { input: create_mock_input() }).start()

    actor.send({ type: 'TOGGLE_FOLDER', path: 'docs' })
    actor.send({ type: 'VAULT_CHANGED' })

    await waitFor(actor, () => actor.getSnapshot().context.load_states.get('') === 'loaded')

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.expanded_paths.size).toBe(0)
    expect(snapshot.context.load_states.get('')).toBe('loaded')
    expect(snapshot.context.active_loads.has('')).toBe(false)

    actor.stop()
  })

  it('ignores stale load completion from previous generation', () => {
    const input = create_mock_input()
    input.get_vault_generation.mockReturnValue(2)
    const actor = createActor(filetree_flow_machine, { input }).start()

    actor.send({
      type: 'FOLDER_LOAD_DONE',
      path: 'docs',
      generation: 1,
      events: [{ type: 'notes_set', notes: [] }]
    })

    expect(actor.getSnapshot().context.load_states.get('docs')).not.toBe('loaded')
    expect(input.dispatch_many).not.toHaveBeenCalled()

    actor.stop()
  })
})
