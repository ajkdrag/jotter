import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { create_mock_ports } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { as_vault_id } from '$lib/types/ids'

describe('change_vault_flow errors', () => {
  it('transitions to error when open fails and can cancel', async () => {
    const ports = create_mock_ports()
    const stores = create_mock_stores()
    ports.vault.open_vault_by_id = () => Promise.reject(new Error('Open failed'))

    const actor = createActor(change_vault_flow_machine, {
      input: { ports, dispatch_many: stores.dispatch_many, now_ms: stores.now_ms }
    })
    actor.start()

    actor.send({ type: 'SELECT_VAULT', vault_id: as_vault_id('missing') })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'CANCEL' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')
    expect(actor.getSnapshot().context.error).toBeNull()
  })
})
