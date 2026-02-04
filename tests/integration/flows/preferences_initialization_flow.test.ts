import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { preferences_initialization_flow_machine } from '$lib/flows/preferences_initialization_flow'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { as_vault_id, as_vault_path } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

const TEST_VAULT: Vault = {
  id: as_vault_id('test-vault-id'),
  name: 'Test Vault',
  path: as_vault_path('/test/vault'),
  created_at: 0
}

describe('preferences_initialization_flow', () => {
  it('initializes theme and editor settings', async () => {
    const ports = create_test_ports()
    const stores = create_mock_stores()

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings, vault_settings: ports.vault_settings },
        stores
      }
    })

    actor.start()

    actor.send({ type: 'INITIALIZE' })

    await waitFor(actor, (state) => state.matches('idle'), { timeout: 1000 })

    expect(stores.ui.get_snapshot().theme).toBeDefined()
  })

  it('transitions to error state on initialization failure', async () => {
    const ports = create_test_ports()
    ports.vault_settings.get_vault_setting = vi.fn().mockRejectedValue(new Error('Settings load failed'))

    const stores = create_mock_stores()
    stores.vault.actions.set_vault(TEST_VAULT)

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings, vault_settings: ports.vault_settings },
        stores
      }
    })

    actor.start()

    actor.send({ type: 'INITIALIZE' })

    await waitFor(actor, (state) => state.matches('error'))

    expect(actor.getSnapshot().context.error).toBe('Error: Settings load failed')
  })

  it('retries from error state', async () => {
    const ports = create_test_ports()
    let call_count = 0
    ports.vault_settings.get_vault_setting = vi.fn().mockImplementation(() => {
      call_count++
      if (call_count === 1) throw new Error('First attempt failed')
      return Promise.resolve(null)
    })

    const stores = create_mock_stores()
    stores.vault.actions.set_vault(TEST_VAULT)

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings, vault_settings: ports.vault_settings },
        stores
      }
    })

    actor.start()

    actor.send({ type: 'INITIALIZE' })

    await waitFor(actor, (state) => state.matches('error'), { timeout: 1000 })

    actor.send({ type: 'RETRY' })

    await waitFor(actor, (state) => state.matches('idle'), { timeout: 1000 })

    expect(call_count).toBe(2)
    expect(stores.ui.get_snapshot().theme).toBeDefined()
  })

  it('cancels from error state and returns to idle', async () => {
    const ports = create_test_ports()
    ports.vault_settings.get_vault_setting = vi.fn().mockRejectedValue(new Error('Settings load failed'))

    const stores = create_mock_stores()
    stores.vault.actions.set_vault(TEST_VAULT)

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings, vault_settings: ports.vault_settings },
        stores
      }
    })

    actor.start()

    actor.send({ type: 'INITIALIZE' })

    await waitFor(actor, (state) => state.matches('error'))

    actor.send({ type: 'CANCEL' })

    await waitFor(actor, (state) => state.matches('idle'))

    expect(actor.getSnapshot().context.error).toBeNull()
  })
})
