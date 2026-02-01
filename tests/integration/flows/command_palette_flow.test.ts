import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { command_palette_flow_machine } from '$lib/flows/command_palette_flow'

describe('command_palette_flow', () => {
  it('opens and resets selected index', () => {
    const actor = createActor(command_palette_flow_machine).start()
    actor.send({ type: 'OPEN' })

    expect(actor.getSnapshot().value).toBe('open')
    expect(actor.getSnapshot().context.selected_index).toBe(0)
    actor.stop()
  })

  it('toggles open and closed', () => {
    const actor = createActor(command_palette_flow_machine).start()
    actor.send({ type: 'TOGGLE' })
    expect(actor.getSnapshot().value).toBe('open')
    actor.send({ type: 'TOGGLE' })
    expect(actor.getSnapshot().value).toBe('closed')
    actor.stop()
  })

  it('updates selected index while open', () => {
    const actor = createActor(command_palette_flow_machine).start()
    actor.send({ type: 'OPEN' })
    actor.send({ type: 'SET_SELECTED_INDEX', index: 3 })

    expect(actor.getSnapshot().context.selected_index).toBe(3)
    actor.stop()
  })

  it('executes command and closes', () => {
    const actor = createActor(command_palette_flow_machine).start()
    actor.send({ type: 'OPEN' })
    actor.send({ type: 'EXECUTE_COMMAND', command: 'open-settings' })

    expect(actor.getSnapshot().value).toBe('closed')
    actor.stop()
  })
})
