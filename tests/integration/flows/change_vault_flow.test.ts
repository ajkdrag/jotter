import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { create_mock_ports } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

describe('change_vault_flow', () => {
  test('choosing a vault updates stores', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores({ now_ms: () => 123 })

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault]
    ports.vault.choose_vault = () => Promise.resolve(vault.path)

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, stores }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.vault.get_snapshot().vault).toEqual(vault)
    expect(stores.notes.get_snapshot().notes).toEqual([])
    expect(stores.editor.get_snapshot().open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(stores.vault.get_snapshot().recent_vaults).toEqual([vault])
  })

  test('cancelling vault chooser keeps stores unchanged', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores()

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, stores }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.vault.get_snapshot().vault).toBeNull()
  })
})
