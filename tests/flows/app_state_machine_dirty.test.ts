import { describe, expect, test } from 'vitest'
import { createActor } from 'xstate'
import { app_state_machine } from '$lib/state/app_state_machine'
import type { Vault } from '$lib/types/vault'
import type { VaultId, VaultPath } from '$lib/types/ids'

describe('app_state_machine dirty tracking', () => {
  test('dirty toggles based on revision id vs saved baseline', () => {
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    const vault: Vault = {
      id: 'v1' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })

    const open_note = app_state.getSnapshot().context.open_note
    expect(open_note).not.toBeNull()
    expect(open_note?.dirty).toBe(false)

    const note_id = open_note!.meta.id

    app_state.send({ type: 'NOTIFY_REVISION_CHANGED', note_id, revision_id: 1, sticky_dirty: false })
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(true)

    app_state.send({ type: 'NOTIFY_REVISION_CHANGED', note_id, revision_id: 0, sticky_dirty: false })
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(false)
  })

  test('sticky dirty forces dirty even at baseline revision', () => {
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    const vault: Vault = {
      id: 'v1' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })

    const open_note = app_state.getSnapshot().context.open_note
    expect(open_note).not.toBeNull()

    const note_id = open_note!.meta.id

    app_state.send({ type: 'NOTIFY_REVISION_CHANGED', note_id, revision_id: 0, sticky_dirty: true })
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(true)
  })
})
