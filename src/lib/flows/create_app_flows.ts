import type { Ports } from '$lib/adapters/create_prod_ports'
import { create_app_stores, type AppStores } from '$lib/stores/create_app_stores'
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
import { create_folder_flow_machine } from '$lib/flows/create_folder_flow'
import type { CreateFolderFlowContext, CreateFolderFlowEvents } from '$lib/flows/create_folder_flow'
import { app_startup_flow_machine } from '$lib/flows/app_startup_flow'
import type { AppStartupFlowContext, AppStartupFlowEvents } from '$lib/flows/app_startup_flow'
import { command_palette_flow_machine } from '$lib/flows/command_palette_flow'
import type { CommandPaletteFlowContext, CommandPaletteFlowEvents } from '$lib/flows/command_palette_flow'
import { filetree_flow_machine } from '$lib/flows/filetree_flow'
import type { FiletreeFlowContext, FiletreeFlowEvents } from '$lib/flows/filetree_flow'
import { delete_folder_flow_machine } from '$lib/flows/delete_folder_flow'
import type { DeleteFolderFlowContext, DeleteFolderFlowEvents } from '$lib/flows/delete_folder_flow'
import { rename_folder_flow_machine } from '$lib/flows/rename_folder_flow'
import type { RenameFolderFlowContext, RenameFolderFlowEvents } from '$lib/flows/rename_folder_flow'
import { create_flow_handle } from '$lib/flows/flow_engine'
import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'

export type CreateAppFlowsCallbacks = {
  on_save_complete?: () => void
}

export type AppFlows = {
  stores: AppStores
  flows: {
    app_startup: FlowHandle<AppStartupFlowEvents, FlowSnapshot<AppStartupFlowContext>>
    open_app: FlowHandle<OpenAppFlowEvents, FlowSnapshot<OpenAppFlowContext>>
    change_vault: FlowHandle<ChangeVaultFlowEvents, FlowSnapshot<ChangeVaultFlowContext>>
    open_note: FlowHandle<OpenNoteFlowEvents, FlowSnapshot<OpenNoteFlowContext>>
    delete_note: FlowHandle<DeleteNoteFlowEvents, FlowSnapshot<DeleteNoteFlowContext>>
    rename_note: FlowHandle<RenameNoteFlowEvents, FlowSnapshot<RenameNoteFlowContext>>
    delete_folder: FlowHandle<DeleteFolderFlowEvents, FlowSnapshot<DeleteFolderFlowContext>>
    rename_folder: FlowHandle<RenameFolderFlowEvents, FlowSnapshot<RenameFolderFlowContext>>
    save_note: FlowHandle<SaveNoteFlowEvents, FlowSnapshot<SaveNoteFlowContext>>
    create_folder: FlowHandle<CreateFolderFlowEvents, FlowSnapshot<CreateFolderFlowContext>>
    settings: FlowHandle<SettingsFlowEvents, FlowSnapshot<SettingsFlowContext>>
    command_palette: FlowHandle<CommandPaletteFlowEvents, FlowSnapshot<CommandPaletteFlowContext>>
    filetree: FlowHandle<FiletreeFlowEvents, FlowSnapshot<FiletreeFlowContext>>
  }
}

export function create_app_flows(ports: Ports, callbacks?: CreateAppFlowsCallbacks): AppFlows {
  const stores = create_app_stores()

  const filetree = create_flow_handle(filetree_flow_machine, {
    input: {
      ports: { notes: ports.notes },
      stores,
      get_vault_id: () => stores.vault.get_snapshot().vault?.id ?? null
    }
  })

  stores.vault.subscribe((state) => {
    if (state.vault) {
      filetree.send({ type: 'VAULT_CHANGED' })
    }
  })

  const open_app = create_flow_handle(open_app_flow_machine, {
    input: {
      ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
      stores
    }
  })

  const change_vault = create_flow_handle(change_vault_flow_machine, {
    input: {
      ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
      stores
    }
  })

  const open_note = create_flow_handle(open_note_flow_machine, {
    input: { ports: { notes: ports.notes }, stores }
  })

  const delete_note = create_flow_handle(delete_note_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores }
  })

  const rename_note = create_flow_handle(rename_note_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores }
  })

  const save_note = create_flow_handle(save_note_flow_machine, {
    input: {
      ports: { notes: ports.notes },
      stores,
      ...(callbacks?.on_save_complete && { on_save_complete: callbacks.on_save_complete })
    }
  })

  const settings = create_flow_handle(settings_flow_machine, {
    input: { ports: { settings: ports.settings }, stores }
  })

  const create_folder = create_flow_handle(create_folder_flow_machine, {
    input: { ports: { notes: ports.notes }, stores }
  })

  const app_startup = create_flow_handle(app_startup_flow_machine, {
    input: { ports: { theme: ports.theme, settings: ports.settings }, stores }
  })

  const command_palette = create_flow_handle(command_palette_flow_machine, { input: {} })

  const delete_folder = create_flow_handle(delete_folder_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores }
  })

  const rename_folder = create_flow_handle(rename_folder_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores }
  })

  return {
    stores,
    flows: {
      app_startup,
      open_app,
      change_vault,
      open_note,
      delete_note,
      rename_note,
      delete_folder,
      rename_folder,
      save_note,
      create_folder,
      settings,
      command_palette,
      filetree
    }
  }
}
