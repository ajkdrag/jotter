import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { command_palette_flow_machine } from '$lib/flows/command_palette_flow'

describe('command_palette_flow selection reset', () => {
  it('resets selected index on open', () => {
    const actor = createActor(command_palette_flow_machine).start()
    actor.send({ type: 'OPEN' })
    actor.send({ type: 'SET_SELECTED_INDEX', index: 4 })

    actor.send({ type: 'CLOSE' })
    actor.send({ type: 'OPEN' })

    expect(actor.getSnapshot().context.selected_index).toBe(0)
    actor.stop()
  })
})
