import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { create_mock_ports } from '../helpers/mock_ports'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'

describe('change_vault_flow', () => {
  test('choosing a vault updates app_state and navigates', async () => {
    const ports = create_mock_ports()

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    const notes: NoteMeta[] = [
      { id: 'note1.md' as any, path: 'note1.md' as NotePath, title: 'Note 1', mtime_ms: 0, size_bytes: 0 }
    ]

    ports.vault._mock_vaults = [vault]
    ports.notes._mock_notes.set(vault.id, notes)
    ports.vault.choose_vault = async () => vault.path

    const app_state = {
      vault: null as Vault | null,
      recent_vaults: [] as Vault[],
      notes: [] as NoteMeta[],
      open_note: null as OpenNoteState | null
    }

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, app_state, now_ms: () => 123 }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.vault).toEqual(vault)
    expect(app_state.notes).toEqual(notes)
    expect(app_state.open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(ports.navigation._calls.navigate_to_home).toBe(1)
    expect(app_state.recent_vaults).toEqual([vault])
  })

  test('cancelling vault chooser does not navigate', async () => {
    const ports = create_mock_ports()

    const app_state = {
      vault: null as Vault | null,
      recent_vaults: [] as Vault[],
      notes: [] as NoteMeta[],
      open_note: null as OpenNoteState | null
    }

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, app_state }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.vault).toBe(null)
    expect(ports.navigation._calls.navigate_to_home).toBe(0)
  })
})

