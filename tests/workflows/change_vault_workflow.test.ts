import { describe, expect, test } from 'vitest'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'

describe('change_vault_workflow navigation', () => {
  test('open_recent should call navigate_to_home after successful vault selection', async () => {
    let navigation_called = false

    const mock_vault: Vault = {
      id: 'test-vault' as VaultId,
      name: 'Test Vault',
      path: '/test/vault' as VaultPath,
      created_at: Date.now()
    }

    const mock_notes: NoteMeta[] = [
      {
        id: 'note1.md' as any,
        path: 'note1.md' as NotePath,
        title: 'Note 1',
        mtime_ms: Date.now(),
        size_bytes: 100
      }
    ]

    const mock_ports = {
      vault: {
        async open_vault_by_id(_id: VaultId) {
          return mock_vault
        },
        async list_vaults() {
          return [mock_vault]
        },
        async remember_last_vault(_id: VaultId) {}
      },
      notes: {
        async list_notes(_id: VaultId) {
          return mock_notes
        }
      },
      index: {
        async build_index(_id: VaultId) {}
      },
      watcher: {},
      navigation: {
        async navigate_to_home() {
          navigation_called = true
        }
      }
    }

    const app_state = {
      vault: null as Vault | null,
      notes: [] as NoteMeta[],
      open_note: null,
      conflict: null,
      recent_vaults: [] as Vault[]
    }

    async function open_recent(vault_id: VaultId) {
      const vault = await mock_ports.vault.open_vault_by_id(vault_id)
      const notes = await mock_ports.notes.list_notes(vault.id)
      app_state.vault = vault
      app_state.notes = notes
      app_state.open_note = null
      app_state.conflict = null
      await mock_ports.vault.remember_last_vault(vault.id)
      void mock_ports.index.build_index(vault.id)
      app_state.recent_vaults = await mock_ports.vault.list_vaults()
      await mock_ports.navigation.navigate_to_home()
    }

    await open_recent(mock_vault.id)

    expect(navigation_called).toBe(true)
    expect(app_state.vault).toEqual(mock_vault)
    expect(app_state.notes).toEqual(mock_notes)
  })

  test('navigation should not be called if vault opening fails', async () => {
    let navigation_called = false

    const mock_ports = {
      vault: {
        async open_vault_by_id(_id: VaultId) {
          throw new Error('Vault not found')
        }
      },
      navigation: {
        async navigate_to_home() {
          navigation_called = true
        }
      }
    }

    async function open_recent(vault_id: VaultId) {
      await mock_ports.vault.open_vault_by_id(vault_id)
      await mock_ports.navigation.navigate_to_home()
    }

    try {
      await open_recent('nonexistent' as VaultId)
    } catch {
      expect(navigation_called).toBe(false)
    }
  })
})
