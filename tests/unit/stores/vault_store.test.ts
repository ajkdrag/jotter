import { describe, expect, it } from 'vitest'
import { VaultStore } from '$lib/stores/vault_store.svelte'
import { create_test_vault } from '../helpers/test_fixtures'

describe('VaultStore', () => {
  it('sets and clears vault while updating generation', () => {
    const store = new VaultStore()
    const initial_generation = store.generation

    const vault = create_test_vault()
    store.set_vault(vault)

    expect(store.vault).toEqual(vault)
    expect(store.generation).toBe(initial_generation + 1)

    store.clear()

    expect(store.vault).toBeNull()
    expect(store.generation).toBe(initial_generation + 2)
  })

  it('sets recent vaults', () => {
    const store = new VaultStore()
    const vault = create_test_vault()

    store.set_recent_vaults([vault])

    expect(store.recent_vaults).toEqual([vault])
  })

  it('bumps generation without changing vault selection', () => {
    const store = new VaultStore()
    const initial_generation = store.generation

    store.bump_generation()

    expect(store.generation).toBe(initial_generation + 1)
    expect(store.vault).toBeNull()
  })
})
