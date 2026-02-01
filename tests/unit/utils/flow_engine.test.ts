import { describe, it, expect } from 'vitest'
import { command_palette_flow_machine } from '$lib/flows/command_palette_flow'
import { create_flow_handle } from '$lib/flows/flow_engine'

describe('create_flow_handle', () => {
  it('wraps actor with snapshot helpers', () => {
    const handle = create_flow_handle(command_palette_flow_machine, { input: {} })

    handle.send({ type: 'OPEN' })
    const snapshot = handle.get_snapshot()

    expect(snapshot.matches('open')).toBe(true)
    handle.stop()
  })

  it('subscribes to snapshots and unsubscribes', () => {
    const handle = create_flow_handle(command_palette_flow_machine, { input: {} })
    let count = 0
    const unsubscribe = handle.subscribe(() => {
      count += 1
    })

    handle.send({ type: 'OPEN' })
    handle.send({ type: 'CLOSE' })
    unsubscribe()
    handle.send({ type: 'OPEN' })

    expect(count).toBeGreaterThan(0)
    handle.stop()
  })
})
