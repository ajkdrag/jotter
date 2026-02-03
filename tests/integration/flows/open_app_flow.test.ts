import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { open_app_flow_machine } from '$lib/flows/open_app_flow'
import { create_mock_ports } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

describe('open_app_flow', () => {
  test('loads recents and updates stores', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores({ now_ms: () => 123 })

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

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
        stores
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: null }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.vault.get_snapshot().recent_vaults).toEqual([vault1, vault2])
    expect(stores.vault.get_snapshot().vault).toBeNull()
  })

  test('when bootstrap path is provided, opens vault and updates stores', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores({ now_ms: () => 123 })

    const vault: Vault = {
      id: 'vault-1' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: 0
    }

    ports.vault._mock_vaults = [vault]

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
        stores
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: vault.path }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.vault.get_snapshot().vault).toEqual(vault)
    expect(stores.notes.get_snapshot().notes).toEqual([])
    expect(stores.editor.get_snapshot().open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(stores.vault.get_snapshot().recent_vaults).toEqual([vault])
  })

  test('error handling when list_vaults throws', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
        stores
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
    const stores = create_mock_stores()

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

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
        stores
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
    const stores = create_mock_stores()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
        stores
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
    const stores = create_mock_stores()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
        stores
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
