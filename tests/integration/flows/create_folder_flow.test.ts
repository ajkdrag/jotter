import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { create_folder_flow_machine } from '$lib/flows/create_folder_flow'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_id } from '$lib/types/ids'
import { create_mock_stores } from '../../unit/helpers/mock_stores'

describe('create_folder_flow', () => {
  it('creates folder and adds path to store on confirm', async () => {
    const ports = create_test_ports()
    const stores = create_mock_stores()
    const vault_id = as_vault_id('test-vault')

    const actor = createActor(create_folder_flow_machine, {
      input: {
        ports: { notes: ports.notes },
        stores,
        dispatch_many: stores.dispatch_many
      }
    })

    actor.start()

    actor.send({ type: 'REQUEST_CREATE', vault_id, parent_path: 'parent' })
    await waitFor(actor, (state) => state.matches('dialog_open'))

    actor.send({ type: 'UPDATE_FOLDER_NAME', name: 'new-folder' })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (state) => state.matches('idle'))

    expect(stores.notes.get_snapshot().folder_paths).toContain('parent/new-folder')
  })

  it('returns to idle on cancel from dialog', async () => {
    const ports = create_test_ports()
    const stores = create_mock_stores()
    const vault_id = as_vault_id('test-vault')

    const actor = createActor(create_folder_flow_machine, {
      input: {
        ports: { notes: ports.notes },
        stores,
        dispatch_many: stores.dispatch_many
      }
    })

    actor.start()

    actor.send({ type: 'REQUEST_CREATE', vault_id, parent_path: 'parent' })
    await waitFor(actor, (state) => state.matches('dialog_open'))

    actor.send({ type: 'CANCEL' })
    await waitFor(actor, (state) => state.matches('idle'))

    expect(stores.notes.get_snapshot().folder_paths).toEqual([])
  })

  it('transitions to error state on create failure', async () => {
    const ports = create_test_ports()
    ports.notes.create_folder = vi.fn().mockRejectedValue(new Error('Create failed'))

    const stores = create_mock_stores()
    const vault_id = as_vault_id('test-vault')

    const actor = createActor(create_folder_flow_machine, {
      input: {
        ports: { notes: ports.notes },
        stores,
        dispatch_many: stores.dispatch_many
      }
    })

    actor.start()

    actor.send({ type: 'REQUEST_CREATE', vault_id, parent_path: 'parent' })
    await waitFor(actor, (state) => state.matches('dialog_open'))

    actor.send({ type: 'UPDATE_FOLDER_NAME', name: 'new-folder' })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (state) => state.matches('error'))

    expect(actor.getSnapshot().context.error).toBe('Error: Create failed')
  })

  it('retries from error state', async () => {
    const ports = create_test_ports()
    let call_count = 0
    ports.notes.create_folder = vi.fn().mockImplementation(() => {
      call_count++
      if (call_count === 1) throw new Error('First attempt failed')
      return Promise.resolve()
    })

    const stores = create_mock_stores()
    const vault_id = as_vault_id('test-vault')

    const actor = createActor(create_folder_flow_machine, {
      input: {
        ports: { notes: ports.notes },
        stores,
        dispatch_many: stores.dispatch_many
      }
    })

    actor.start()

    actor.send({ type: 'REQUEST_CREATE', vault_id, parent_path: 'parent' })
    await waitFor(actor, (state) => state.matches('dialog_open'))

    actor.send({ type: 'UPDATE_FOLDER_NAME', name: 'new-folder' })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (state) => state.matches('error'))

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (state) => state.matches('idle'))

    expect(call_count).toBe(2)
    expect(stores.notes.get_snapshot().folder_paths).toContain('parent/new-folder')
  })
})
