import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { open_app_flow_machine } from '$lib/flows/open_app_flow'
import { app_state_machine } from '$lib/state/app_state_machine'
import { create_mock_ports } from '../helpers/mock_ports'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'

describe('open_app_flow', () => {
  test('loads recents and dispatches RECENT_VAULTS_SET', async () => {
    const ports = create_mock_ports()

    const vault1: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault 1',
      path: '/test/vault1' as VaultPath,
      created_at: 0
    }

    const vault2: Vault = {
      id: 'vault-2' as VaultId,
      name: 'Test Vault 2',
      path: '/test/vault2' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault1, vault2]

    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: app_state.send,
        get_app_state_snapshot: () => ({
          context: app_state.getSnapshot().context,
          matches: (state: string) => {
            if (state === 'no_vault' || state === 'vault_open') {
              return app_state.getSnapshot().matches(state)
            }
            return false
          }
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: null }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().context.recent_vaults).toEqual([vault1, vault2])
    expect(app_state.getSnapshot().context.vault).toBeNull()
  })

  test('when bootstrap path is provided, opens vault and dispatches VAULT_SET', async () => {
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

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: app_state.send,
        get_app_state_snapshot: () => ({
          context: app_state.getSnapshot().context,
          matches: (state: string) => {
            if (state === 'no_vault' || state === 'vault_open') {
              return app_state.getSnapshot().matches(state)
            }
            return false
          }
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: vault.path }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().context.vault).toEqual(vault)
    expect(app_state.getSnapshot().context.notes).toEqual([])
    expect(app_state.getSnapshot().context.open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(app_state.getSnapshot().context.recent_vaults).toEqual([vault])
  })

  test('error handling when list_vaults throws', async () => {
    const ports = create_mock_ports()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: app_state.send,
        get_app_state_snapshot: () => ({
          context: app_state.getSnapshot().context,
          matches: (state: string) => {
            if (state === 'no_vault' || state === 'vault_open') {
              return app_state.getSnapshot().matches(state)
            }
            return false
          }
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: null }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.error).toBe('Error: Failed to list vaults')
  })

  test('error handling when bootstrap open throws', async () => {
    const ports = create_mock_ports()

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault]
    ports.vault.open_vault = async () => {
      throw new Error('Failed to open vault')
    }

    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: app_state.send,
        get_app_state_snapshot: () => ({
          context: app_state.getSnapshot().context,
          matches: (state: string) => {
            if (state === 'no_vault' || state === 'vault_open') {
              return app_state.getSnapshot().matches(state)
            }
            return false
          }
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: vault.path }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.error).toBe('Error: Failed to open vault')
  })

  test('retry transitions back to starting', async () => {
    const ports = create_mock_ports()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: app_state.send,
        get_app_state_snapshot: () => ({
          context: app_state.getSnapshot().context,
          matches: (state: string) => {
            if (state === 'no_vault' || state === 'vault_open') {
              return app_state.getSnapshot().matches(state)
            }
            return false
          }
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: null }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    ports.vault.list_vaults = async () => []
    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')
  })

  test('cancel clears error and returns to idle', async () => {
    const ports = create_mock_ports()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: app_state.send,
        get_app_state_snapshot: () => ({
          context: app_state.getSnapshot().context,
          matches: (state: string) => {
            if (state === 'no_vault' || state === 'vault_open') {
              return app_state.getSnapshot().matches(state)
            }
            return false
          }
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: null }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'CANCEL' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle' && snapshot.context.error === null)
  })
})
