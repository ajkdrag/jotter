import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { preferences_initialization_flow_machine } from '$lib/flows/preferences_initialization_flow'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'

describe('preferences_initialization_flow', () => {
  it('initializes theme and editor settings', async () => {
    const ports = create_test_ports()
    const stores = create_mock_stores()

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings },
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
    ports.settings.get_setting = vi.fn().mockRejectedValue(new Error('Settings load failed'))

    const stores = create_mock_stores()

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings },
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
    ports.settings.get_setting = vi.fn().mockImplementation(() => {
      call_count++
      if (call_count === 1) throw new Error('First attempt failed')
      return Promise.resolve(null)
    })

    const stores = create_mock_stores()

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings },
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
    ports.settings.get_setting = vi.fn().mockRejectedValue(new Error('Settings load failed'))

    const stores = create_mock_stores()

    const actor = createActor(preferences_initialization_flow_machine, {
      input: {
        ports: { theme: ports.theme, settings: ports.settings },
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
