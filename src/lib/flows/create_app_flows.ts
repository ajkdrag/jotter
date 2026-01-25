import type { Ports } from '$lib/adapters/create_prod_ports'
import type { AppStateEvents } from '$lib/flows/app_state_machine'
import { app_state_machine } from '$lib/flows/app_state_machine'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import { open_note_flow_machine } from '$lib/flows/open_note_flow'
import { delete_note_flow_machine } from '$lib/flows/delete_note_flow'
import { create_flow_handle } from '$lib/flows/flow_engine'

export function create_app_flows(ports: Ports) {
  const model = create_flow_handle(app_state_machine, { input: {} })
  const dispatch = (event: AppStateEvents) => model.send(event)

  const change_vault = create_flow_handle(change_vault_flow_machine, {
    input: {
      ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
      dispatch
    }
  })

  const open_note = create_flow_handle(open_note_flow_machine, {
    input: { ports: { notes: ports.notes }, dispatch }
  })

  const delete_note = create_flow_handle(delete_note_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, dispatch }
  })

  return {
    model,
    flows: {
      change_vault,
      open_note,
      delete_note
    }
  }
}
