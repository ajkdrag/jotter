import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { app_state_machine } from '$lib/flows/app_state_machine'
import { create_mock_ports } from '../helpers/mock_ports'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'

describe('change_vault_flow', () => {
  test('choosing a vault updates model', async () => {
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

    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(model.getSnapshot().context.vault).toEqual(vault)
    expect(model.getSnapshot().context.notes).toEqual(notes)
    expect(model.getSnapshot().context.open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(model.getSnapshot().context.recent_vaults).toEqual([vault])
  })

  test('cancelling vault chooser stays in no_vault state', async () => {
    const ports = create_mock_ports()

    const model = createActor(app_state_machine, { input: {} })
    model.start()

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(model.getSnapshot().value).toBe('no_vault')
  })
})
