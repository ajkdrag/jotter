import type { Ports } from '$lib/adapters/create_prod_ports'
import { app_state_machine, type AppStateEvents, type AppStateContext } from '$lib/state/app_state_machine'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import type { ChangeVaultFlowContext, ChangeVaultFlowEvents } from '$lib/flows/change_vault_flow'
import { open_app_flow_machine } from '$lib/flows/open_app_flow'
import type { OpenAppFlowContext, OpenAppFlowEvents } from '$lib/flows/open_app_flow'
import { open_note_flow_machine } from '$lib/flows/open_note_flow'
import type { OpenNoteFlowContext, OpenNoteFlowEvents } from '$lib/flows/open_note_flow'
import { delete_note_flow_machine } from '$lib/flows/delete_note_flow'
import type { DeleteNoteFlowContext, DeleteNoteFlowEvents } from '$lib/flows/delete_note_flow'
import { rename_note_flow_machine } from '$lib/flows/rename_note_flow'
import type { RenameNoteFlowContext, RenameNoteFlowEvents } from '$lib/flows/rename_note_flow'
import { save_note_flow_machine } from '$lib/flows/save_note_flow'
import type { SaveNoteFlowContext, SaveNoteFlowEvents } from '$lib/flows/save_note_flow'
import { settings_flow_machine } from '$lib/flows/settings_flow'
import type { SettingsFlowContext, SettingsFlowEvents } from '$lib/flows/settings_flow'
import { create_flow_handle } from '$lib/flows/flow_engine'
import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'

export type AppFlows = {
  app_state: FlowHandle<AppStateEvents, FlowSnapshot<AppStateContext>>
  flows: {
    open_app: FlowHandle<OpenAppFlowEvents, FlowSnapshot<OpenAppFlowContext>>
    change_vault: FlowHandle<ChangeVaultFlowEvents, FlowSnapshot<ChangeVaultFlowContext>>
    open_note: FlowHandle<OpenNoteFlowEvents, FlowSnapshot<OpenNoteFlowContext>>
    delete_note: FlowHandle<DeleteNoteFlowEvents, FlowSnapshot<DeleteNoteFlowContext>>
    rename_note: FlowHandle<RenameNoteFlowEvents, FlowSnapshot<RenameNoteFlowContext>>
    save_note: FlowHandle<SaveNoteFlowEvents, FlowSnapshot<SaveNoteFlowContext>>
    settings: FlowHandle<SettingsFlowEvents, FlowSnapshot<SettingsFlowContext>>
  }
}

export function create_app_flows(ports: Ports): AppFlows {
  const app_state = create_flow_handle(app_state_machine, { input: {} })
  const dispatch = (event: AppStateEvents) => app_state.send(event)

  const open_app = create_flow_handle(open_app_flow_machine, {
    input: {
      ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
      dispatch,
      get_app_state_snapshot: app_state.get_snapshot
    }
  })

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

  const rename_note = create_flow_handle(rename_note_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, dispatch }
  })

  const save_note = create_flow_handle(save_note_flow_machine, {
    input: { ports: { notes: ports.notes }, dispatch, get_app_state_snapshot: app_state.get_snapshot }
  })

  const settings = create_flow_handle(settings_flow_machine, {
    input: { ports: { settings: ports.settings } }
  })

  return {
    app_state,
    flows: {
      open_app,
      change_vault,
      open_note,
      delete_note,
      rename_note,
      save_note,
      settings
    }
  }
}
