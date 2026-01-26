import { describe, expect, test } from 'vitest'
import { createActor } from 'xstate'
import { app_state_machine } from '$lib/flows/app_state_machine'
import type { Vault } from '$lib/types/vault'
import type { VaultId, VaultPath } from '$lib/types/ids'

describe('app_state_machine dirty tracking', () => {
  test('dirty toggles based on revision id vs saved baseline', () => {
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()

    const vault: Vault = {
      id: 'v1' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    model.send({ type: 'VAULT_SET', vault, notes: [] })

    const open_note = model.getSnapshot().context.open_note
    expect(open_note).not.toBeNull()
    expect(open_note?.dirty).toBe(false)

    const note_id = open_note!.meta.id

    model.send({ type: 'OPEN_NOTE_REVISION_CHANGED', note_id, revision_id: 1, sticky_dirty: false })
    expect(model.getSnapshot().context.open_note?.dirty).toBe(true)

    model.send({ type: 'OPEN_NOTE_REVISION_CHANGED', note_id, revision_id: 0, sticky_dirty: false })
    expect(model.getSnapshot().context.open_note?.dirty).toBe(false)
  })

  test('sticky dirty forces dirty even at baseline revision', () => {
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()

    const vault: Vault = {
      id: 'v1' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    model.send({ type: 'VAULT_SET', vault, notes: [] })

    const open_note = model.getSnapshot().context.open_note
    expect(open_note).not.toBeNull()

    const note_id = open_note!.meta.id

    model.send({ type: 'OPEN_NOTE_REVISION_CHANGED', note_id, revision_id: 0, sticky_dirty: true })
    expect(model.getSnapshot().context.open_note?.dirty).toBe(true)
  })
})
