import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { create_mock_ports } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

describe('change_vault_flow (select recent)', () => {
  it('selects recent vault by id and updates stores', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores({ now_ms: () => 123 })

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault]

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, stores }
    })
    actor.start()

    actor.send({ type: 'SELECT_VAULT', vault_id: vault.id })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.vault.get_snapshot().vault).toEqual(vault)
    expect(ports.index._calls.build_index).toContain(vault.id)
  })
})
