import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { settings_flow_machine } from '$lib/flows/settings_flow'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { create_test_vault_settings_adapter } from '$lib/adapters/test/test_vault_settings_adapter'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { as_vault_id, as_vault_path } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

const TEST_VAULT: Vault = {
  id: as_vault_id('test-vault-id'),
  name: 'Test Vault',
  path: as_vault_path('/test/vault'),
  created_at: 0
}

function create_stores_with_vault() {
  const stores = create_mock_stores()
  stores.dispatch({ type: 'vault_set', vault: TEST_VAULT })
  return stores
}

describe('settings_flow', () => {
  it('loads settings on open dialog', async () => {
    const settings_port = create_test_settings_adapter()
    const vault_settings_port = create_test_vault_settings_adapter()
    const stores = create_stores_with_vault()

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port, vault_settings: vault_settings_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')

    expect(actor.getSnapshot().context.current_settings).toEqual(DEFAULT_EDITOR_SETTINGS)
    expect(actor.getSnapshot().context.has_unsaved_changes).toBe(false)
  })

  it('updates settings and marks unsaved changes', async () => {
    const settings_port = create_test_settings_adapter()
    const vault_settings_port = create_test_vault_settings_adapter()
    const stores = create_stores_with_vault()

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port, vault_settings: vault_settings_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')

    const updated = { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.25 }
    actor.send({ type: 'UPDATE_SETTINGS', settings: updated })

    expect(actor.getSnapshot().context.current_settings.font_size).toBe(1.25)
    expect(actor.getSnapshot().context.has_unsaved_changes).toBe(true)
  })

  it('saves settings and clears unsaved flag', async () => {
    const settings_port = create_test_settings_adapter()
    const vault_settings_port = create_test_vault_settings_adapter()
    const stores = create_stores_with_vault()

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port, vault_settings: vault_settings_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')

    const updated = { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.25 }
    actor.send({ type: 'UPDATE_SETTINGS', settings: updated })
    actor.send({ type: 'SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing' && !snapshot.context.has_unsaved_changes)

    expect(actor.getSnapshot().context.has_unsaved_changes).toBe(false)
    const saved = await vault_settings_port.get_vault_setting(TEST_VAULT.id, 'editor')
    expect(saved).toEqual(updated)
  })

  it('handles load error and retry', async () => {
    const settings_port = create_test_settings_adapter()
    const vault_settings_port = create_test_vault_settings_adapter()
    const stores = create_stores_with_vault()
    let attempts = 0
    vault_settings_port.get_vault_setting = <T,>(_vault_id: string, _key: string) => {
      attempts++
      if (attempts === 1) return Promise.reject(new Error('Load failed'))
      return Promise.resolve(DEFAULT_EDITOR_SETTINGS as T)
    }

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port, vault_settings: vault_settings_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')
    expect(attempts).toBe(2)
  })
})
