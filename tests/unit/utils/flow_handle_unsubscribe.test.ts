import { describe, it, expect } from 'vitest'
import { create_flow_handle } from '$lib/flows/flow_engine'
import { command_palette_flow_machine } from '$lib/flows/command_palette_flow'

describe('flow_handle unsubscribe', () => {
  it('does not notify after unsubscribe', () => {
    const handle = create_flow_handle(command_palette_flow_machine, { input: {} })
    let count = 0
    const unsubscribe = handle.subscribe(() => {
      count += 1
    })

    handle.send({ type: 'OPEN' })
    unsubscribe()
    handle.send({ type: 'CLOSE' })

    expect(count).toBe(1)
    handle.stop()
  })
})
