import { describe, expect, it } from 'vitest'
import { create_vault_store } from '$lib/stores/vault_store'
import { as_vault_id, as_vault_path } from '$lib/types/ids'

describe('vault_store', () => {
  it('increments generation on vault clear and set events', () => {
    const store = create_vault_store()

    const initial = store.get_snapshot().generation
    store.reduce({ type: 'vault_cleared' })
    const after_clear = store.get_snapshot().generation
    store.reduce({
      type: 'vault_set',
      vault: {
        id: as_vault_id('vault-1'),
        name: 'Vault',
        path: as_vault_path('/vault'),
        created_at: 0
      }
    })
    const after_set = store.get_snapshot().generation

    expect(after_clear).toBe(initial + 1)
    expect(after_set).toBe(after_clear + 1)
  })
})
