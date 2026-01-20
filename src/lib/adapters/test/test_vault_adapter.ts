import type { VaultPort } from '$lib/ports/vault_port'
import { as_vault_id, as_vault_path, type VaultId, type VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

const TEST_VAULT_PATH = as_vault_path('test-vault')
const TEST_VAULT_ID = as_vault_id('test_vault_001')
const TEST_VAULT_NAME = 'Test Vault'

const LAST_VAULT_KEY = 'imdown_test_last_vault_id'

export function create_test_vault_adapter(): VaultPort {
  return {
    async choose_vault(): Promise<VaultPath | null> {
      return TEST_VAULT_PATH
    },

    async open_vault(vault_path: VaultPath): Promise<Vault> {
      if (vault_path !== TEST_VAULT_PATH) {
        throw new Error(`Test adapter only supports path: ${TEST_VAULT_PATH}`)
      }

      return {
        id: TEST_VAULT_ID,
        path: TEST_VAULT_PATH,
        name: TEST_VAULT_NAME,
        created_at: Date.now()
      }
    },

    async open_vault_by_id(vault_id: VaultId): Promise<Vault> {
      if (vault_id !== TEST_VAULT_ID) {
        throw new Error(`Test adapter only supports vault ID: ${TEST_VAULT_ID}`)
      }

      return {
        id: TEST_VAULT_ID,
        path: TEST_VAULT_PATH,
        name: TEST_VAULT_NAME,
        created_at: Date.now()
      }
    },

    async list_vaults(): Promise<Vault[]> {
      return [
        {
          id: TEST_VAULT_ID,
          path: TEST_VAULT_PATH,
          name: TEST_VAULT_NAME,
          created_at: Date.now()
        }
      ]
    },

    async remember_last_vault(vault_id: VaultId): Promise<void> {
      localStorage.setItem(LAST_VAULT_KEY, vault_id)
    },

    async get_last_vault_id(): Promise<VaultId | null> {
      const stored = localStorage.getItem(LAST_VAULT_KEY)
      return stored ? as_vault_id(stored) : null
    }
  }
}
