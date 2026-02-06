import type { Ports } from '$lib/ports/ports'
import type { AppStores } from '$lib/stores/create_app_stores'
import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
import type { ChangeVaultFlowContext, ChangeVaultFlowEvents } from '$lib/flows/change_vault_flow'
import { vault_bootstrap_flow_machine } from '$lib/flows/vault_bootstrap_flow'
import type { VaultBootstrapFlowContext, VaultBootstrapFlowEvents } from '$lib/flows/vault_bootstrap_flow'
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
import { preferences_initialization_flow_machine } from '$lib/flows/preferences_initialization_flow'
import type { PreferencesInitializationFlowContext, PreferencesInitializationFlowEvents } from '$lib/flows/preferences_initialization_flow'
import { command_palette_flow_machine } from '$lib/flows/command_palette_flow'
import type { CommandPaletteFlowContext, CommandPaletteFlowEvents } from '$lib/flows/command_palette_flow'
import { filetree_flow_machine } from '$lib/flows/filetree_flow'
import type { FiletreeFlowContext, FiletreeFlowEvents } from '$lib/flows/filetree_flow'
import { delete_folder_flow_machine } from '$lib/flows/delete_folder_flow'
import type { DeleteFolderFlowContext, DeleteFolderFlowEvents } from '$lib/flows/delete_folder_flow'
import { rename_folder_flow_machine } from '$lib/flows/rename_folder_flow'
import type { RenameFolderFlowContext, RenameFolderFlowEvents } from '$lib/flows/rename_folder_flow'
import { file_search_flow_machine } from '$lib/flows/file_search_flow'
import type { FileSearchFlowContext, FileSearchFlowEvents } from '$lib/flows/file_search_flow'
import { create_flow_handle } from '$lib/flows/flow_engine'
import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'
import { clipboard_flow_machine } from '$lib/flows/clipboard_flow'
import type { ClipboardFlowContext, ClipboardFlowEvents } from '$lib/flows/clipboard_flow'
import { theme_flow_machine } from '$lib/flows/theme_flow'
import type { ThemeFlowContext, ThemeFlowEvents } from '$lib/flows/theme_flow'
import { editor_flow_machine } from '$lib/flows/editor_flow'
import type { EditorFlowContext, EditorFlowEvents } from '$lib/flows/editor_flow'
import type { EditorRuntime } from '$lib/shell/editor_runtime'
import type { AppEvent } from '$lib/events/app_event'

export type AppFlows = {
  stores: AppStores
  dispatch: (event: AppEvent) => void
  dispatch_many: (events: AppEvent[]) => void
  flows: {
    preferences_initialization: FlowHandle<PreferencesInitializationFlowEvents, FlowSnapshot<PreferencesInitializationFlowContext>>
    vault_bootstrap: FlowHandle<VaultBootstrapFlowEvents, FlowSnapshot<VaultBootstrapFlowContext>>
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
    file_search: FlowHandle<FileSearchFlowEvents, FlowSnapshot<FileSearchFlowContext>>
    filetree: FlowHandle<FiletreeFlowEvents, FlowSnapshot<FiletreeFlowContext>>
    clipboard: FlowHandle<ClipboardFlowEvents, FlowSnapshot<ClipboardFlowContext>>
    theme: FlowHandle<ThemeFlowEvents, FlowSnapshot<ThemeFlowContext>>
    editor: FlowHandle<EditorFlowEvents, FlowSnapshot<EditorFlowContext>>
  }
}

export function create_app_flows(input: {
  ports: Ports
  stores: AppStores
  dispatch: (event: AppEvent) => void
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
  editor_runtime: EditorRuntime
}): AppFlows {
  const { ports, stores, dispatch, dispatch_many, now_ms, editor_runtime } = input

  const filetree = create_flow_handle(filetree_flow_machine, {
    input: {
      ports: { notes: ports.notes },
      get_vault_id: () => stores.vault.get_snapshot().vault?.id ?? null,
      get_vault_generation: () => stores.vault.get_snapshot().generation,
      dispatch_many
    }
  })

  const vault_bootstrap = create_flow_handle(vault_bootstrap_flow_machine, {
    input: {
      ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
      stores,
      dispatch_many,
      now_ms
    }
  })

  const change_vault = create_flow_handle(change_vault_flow_machine, {
    input: {
      ports: { vault: ports.vault, notes: ports.notes, index: ports.index },
      dispatch_many,
      now_ms
    }
  })

  const open_note = create_flow_handle(open_note_flow_machine, {
    input: { ports: { notes: ports.notes }, stores, dispatch_many, now_ms }
  })

  const delete_note = create_flow_handle(delete_note_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores, dispatch_many, now_ms }
  })

  const rename_note = create_flow_handle(rename_note_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores, dispatch_many }
  })

  const editor = create_flow_handle(editor_flow_machine, {
    input: { runtime: editor_runtime }
  })

  const save_note = create_flow_handle(save_note_flow_machine, {
    input: {
      ports: { notes: ports.notes, index: ports.index },
      stores,
      dispatch_many,
      editor_flow: editor
    }
  })

  const settings = create_flow_handle(settings_flow_machine, {
    input: { ports: { settings: ports.settings, vault_settings: ports.vault_settings }, stores, dispatch_many }
  })

  const create_folder = create_flow_handle(create_folder_flow_machine, {
    input: { ports: { notes: ports.notes }, stores, dispatch_many }
  })

  const preferences_initialization = create_flow_handle(preferences_initialization_flow_machine, {
    input: { ports: { theme: ports.theme, settings: ports.settings, vault_settings: ports.vault_settings }, stores, dispatch_many }
  })

  const command_palette = create_flow_handle(command_palette_flow_machine, { input: {} })

  const file_search = create_flow_handle(file_search_flow_machine, {
    input: {
      ports: { search: ports.search },
      get_vault_id: () => stores.vault.get_snapshot().vault?.id ?? null
    }
  })

  const delete_folder = create_flow_handle(delete_folder_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores, dispatch_many, now_ms }
  })

  const rename_folder = create_flow_handle(rename_folder_flow_machine, {
    input: { ports: { notes: ports.notes, index: ports.index }, stores, dispatch_many }
  })

  const clipboard = create_flow_handle(clipboard_flow_machine, {
    input: { ports: { clipboard: ports.clipboard }, dispatch_many }
  })

  const theme = create_flow_handle(theme_flow_machine, {
    input: { ports: { theme: ports.theme }, dispatch_many }
  })

  return {
    stores,
    dispatch,
    dispatch_many,
    flows: {
      preferences_initialization,
      vault_bootstrap,
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
      file_search,
      filetree,
      clipboard,
      theme,
      editor
    }
  }
}
