import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { settings_flow_machine } from '$lib/flows/settings_flow'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

describe('settings_flow', () => {
  it('loads settings on open dialog', async () => {
    const settings_port = create_test_settings_adapter()

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port } }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')

    expect(actor.getSnapshot().context.current_settings).toEqual(DEFAULT_EDITOR_SETTINGS)
    expect(actor.getSnapshot().context.has_unsaved_changes).toBe(false)
  })

  it('updates settings and marks unsaved changes', async () => {
    const settings_port = create_test_settings_adapter()

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port } }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')

    const updated = { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.25 }
    actor.send({ type: 'UPDATE_SETTINGS', settings: updated })

    expect(actor.getSnapshot().context.current_settings.font_size).toBe(1.25)
    expect(actor.getSnapshot().context.has_unsaved_changes).toBe(true)
  })

  it('saves settings and clears unsaved flag', async () => {
    const settings_port = create_test_settings_adapter()

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port } }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')

    const updated = { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.25 }
    actor.send({ type: 'UPDATE_SETTINGS', settings: updated })
    actor.send({ type: 'SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing' && !snapshot.context.has_unsaved_changes)

    expect(actor.getSnapshot().context.has_unsaved_changes).toBe(false)
    const saved = await settings_port.get_setting('editor')
    expect(saved).toEqual(updated)
  })

  it('handles load error and retry', async () => {
    const settings_port = create_test_settings_adapter()
    let attempts = 0
    settings_port.get_setting = async <T,>(_key: string) => {
      attempts++
      if (attempts === 1) throw new Error('Load failed')
      return DEFAULT_EDITOR_SETTINGS as T
    }

    const actor = createActor(settings_flow_machine, {
      input: { ports: { settings: settings_port } }
    })
    actor.start()

    actor.send({ type: 'OPEN_DIALOG' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'editing')
    expect(attempts).toBe(2)
  })
})
