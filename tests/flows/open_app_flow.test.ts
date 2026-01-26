import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { open_app_flow_machine } from '$lib/flows/open_app_flow'
import { app_state_machine } from '$lib/flows/app_state_machine'
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

    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: model.send,
        get_app_state_snapshot: () => ({
          context: model.getSnapshot().context,
          matches: (state) => model.getSnapshot().matches(state as any)
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: null }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(model.getSnapshot().context.recent_vaults).toEqual([vault1, vault2])
    expect(model.getSnapshot().context.vault).toBeNull()
  })

  test('when bootstrap path is provided, opens vault and dispatches VAULT_SET', async () => {
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

    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: model.send,
        get_app_state_snapshot: () => ({
          context: model.getSnapshot().context,
          matches: (state) => model.getSnapshot().matches(state as any)
        })
      }
    })
    actor.start()

    actor.send({
      type: 'START',
      config: { reset_app_state: false, bootstrap_default_vault_path: vault.path }
    })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(model.getSnapshot().context.vault).toEqual(vault)
    expect(model.getSnapshot().context.notes).toEqual(notes)
    expect(model.getSnapshot().context.open_note?.meta.title).toBe('Untitled-1')
    expect(ports.index._calls.build_index).toContain(vault.id)
    expect(model.getSnapshot().context.recent_vaults).toEqual([vault])
  })

  test('error handling when list_vaults throws', async () => {
    const ports = create_mock_ports()

    ports.vault.list_vaults = async () => {
      throw new Error('Failed to list vaults')
    }

    const model = createActor(app_state_machine, { input: {} })
    model.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: model.send,
        get_app_state_snapshot: () => ({
          context: model.getSnapshot().context,
          matches: (state) => model.getSnapshot().matches(state as any)
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

    const model = createActor(app_state_machine, { input: {} })
    model.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: model.send,
        get_app_state_snapshot: () => ({
          context: model.getSnapshot().context,
          matches: (state) => model.getSnapshot().matches(state as any)
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

    const model = createActor(app_state_machine, { input: {} })
    model.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: model.send,
        get_app_state_snapshot: () => ({
          context: model.getSnapshot().context,
          matches: (state) => model.getSnapshot().matches(state as any)
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

    const model = createActor(app_state_machine, { input: {} })
    model.start()

    const actor = createActor(open_app_flow_machine, {
      input: {
        ports,
        dispatch: model.send,
        get_app_state_snapshot: () => ({
          context: model.getSnapshot().context,
          matches: (state) => model.getSnapshot().matches(state as any)
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
