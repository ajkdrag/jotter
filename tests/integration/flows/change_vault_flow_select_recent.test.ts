import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { app_state_machine } from '$lib/state/app_state_machine'
import { create_mock_ports } from '../../unit/helpers/mock_ports'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

describe('change_vault_flow (select recent)', () => {
  it('selects recent vault by id and updates state', async () => {
    const ports = create_mock_ports()

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault]

    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, dispatch: app_state.send }
    })
    actor.start()

    actor.send({ type: 'SELECT_VAULT', vault_id: vault.id })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().context.vault).toEqual(vault)
    expect(ports.index._calls.build_index).toContain(vault.id)
  })
})
