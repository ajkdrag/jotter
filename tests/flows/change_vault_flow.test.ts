import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { app_state_machine } from '$lib/state/app_state_machine'
import { create_mock_ports } from '../helpers/mock_ports'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'

describe('change_vault_flow', () => {
  test('choosing a vault updates app_state', async () => {
    const ports = create_mock_ports()

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault]
    ports.vault.choose_vault = async () => vault.path

    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, dispatch: app_state.send }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().context.vault).toEqual(vault)
    expect(app_state.getSnapshot().context.notes).toEqual([])
    expect(app_state.getSnapshot().context.open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(app_state.getSnapshot().context.recent_vaults).toEqual([vault])
  })

  test('cancelling vault chooser stays in no_vault state', async () => {
    const ports = create_mock_ports()

    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, dispatch: app_state.send }
    })
    actor.start()

    actor.send({ type: 'CHOOSE_VAULT' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().value).toBe('no_vault')
  })
})
