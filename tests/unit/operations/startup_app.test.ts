import { describe, it, expect } from 'vitest'
import { startup_app } from '$lib/operations/startup_app'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_path } from '$lib/types/ids'

describe('startup_app', () => {
  it('returns recent vaults when no bootstrap path provided', async () => {
    const ports = create_test_ports()

    const result = await startup_app(ports, {
      bootstrap_vault_path: null,
      current_app_state: 'no_vault'
    })

    expect(result.recent_vaults).toBeDefined()
    expect(result.bootstrapped_vault).toBeNull()
  })

  it('returns bootstrapped vault when bootstrap path provided and in no_vault state', async () => {
    const ports = create_test_ports()
    const bootstrap_path = as_vault_path('test-vault')

    const result = await startup_app(ports, {
      bootstrap_vault_path: bootstrap_path,
      current_app_state: 'no_vault'
    })

    expect(result.recent_vaults).toBeDefined()
    expect(result.bootstrapped_vault).not.toBeNull()
    expect(result.bootstrapped_vault?.vault).toBeDefined()
    expect(result.bootstrapped_vault?.vault.path).toBe(bootstrap_path)
    expect(result.bootstrapped_vault?.notes).toBeDefined()
  })

  it('does not bootstrap when already in vault_open state', async () => {
    const ports = create_test_ports()
    const bootstrap_path = as_vault_path('test-vault')

    const result = await startup_app(ports, {
      bootstrap_vault_path: bootstrap_path,
      current_app_state: 'vault_open'
    })

    expect(result.bootstrapped_vault).toBeNull()
  })
})
