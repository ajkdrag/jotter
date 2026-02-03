<script lang="ts">
  import VaultDialog from '$lib/components/vault_dialog.svelte'
  import DeleteNoteDialog from '$lib/components/delete_note_dialog.svelte'
  import RenameNoteDialog from '$lib/components/rename_note_dialog.svelte'
  import DeleteFolderDialog from '$lib/components/delete_folder_dialog.svelte'
  import RenameFolderDialog from '$lib/components/rename_folder_dialog.svelte'
  import SaveNoteDialog from '$lib/components/save_note_dialog.svelte'
  import SettingsDialog from '$lib/components/settings_dialog.svelte'
  import CreateFolderDialog from '$lib/components/create_folder_dialog.svelte'
  import CommandPalette from '$lib/components/command_palette.svelte'
  import FileSearchDialog from '$lib/components/file_search_dialog.svelte'

  import type { VaultState } from '$lib/stores/vault_store'
  import type { NotesState } from '$lib/stores/notes_store'
  import type { FlowSnapshot } from '$lib/flows/flow_handle'
  import type { ChangeVaultFlowContext } from '$lib/flows/change_vault_flow'
  import type { DeleteNoteFlowContext } from '$lib/flows/delete_note_flow'
  import type { RenameNoteFlowContext } from '$lib/flows/rename_note_flow'
  import type { SaveNoteFlowContext } from '$lib/flows/save_note_flow'
  import type { SettingsFlowContext } from '$lib/flows/settings_flow'
  import type { CreateFolderFlowContext } from '$lib/flows/create_folder_flow'
  import type { CommandPaletteFlowContext, CommandPaletteFlowEvents } from '$lib/flows/command_palette_flow'
  import type { FileSearchFlowContext, FileSearchFlowEvents } from '$lib/flows/file_search_flow'
  import type { DeleteFolderFlowContext, DeleteFolderFlowEvents } from '$lib/flows/delete_folder_flow'
  import type { RenameFolderFlowContext, RenameFolderFlowEvents } from '$lib/flows/rename_folder_flow'
  import type { NoteId } from '$lib/types/ids'

  import type { AppShellActions } from '$lib/components/app_shell_actions'

  type FlowView<TEvent, TContext> = {
    snapshot: FlowSnapshot<TContext>
    send: (event: TEvent) => void
  }

  type Props = {
    has_vault: boolean
    hide_choose_vault_button: boolean
    vault_selection_loading: boolean

    vault_store_state: VaultState

    change_vault_snapshot: FlowSnapshot<ChangeVaultFlowContext>
    delete_note_snapshot: FlowSnapshot<DeleteNoteFlowContext>
    rename_note_snapshot: FlowSnapshot<RenameNoteFlowContext>
    save_note_snapshot: FlowSnapshot<SaveNoteFlowContext>
    create_folder_snapshot: FlowSnapshot<CreateFolderFlowContext>
    settings_snapshot: FlowSnapshot<SettingsFlowContext>

    delete_folder: FlowView<DeleteFolderFlowEvents, DeleteFolderFlowContext>
    rename_folder: FlowView<RenameFolderFlowEvents, RenameFolderFlowContext>
    command_palette: FlowView<CommandPaletteFlowEvents, CommandPaletteFlowContext>
    file_search: FlowView<FileSearchFlowEvents, FileSearchFlowContext>
    notes_store_state: NotesState
    on_open_note: (note_id: NoteId) => void

    actions: AppShellActions
  }

  let {
    has_vault,
    hide_choose_vault_button,
    vault_selection_loading,
    vault_store_state,
    change_vault_snapshot,
    delete_note_snapshot,
    rename_note_snapshot,
    save_note_snapshot,
    delete_folder,
    rename_folder,
    create_folder_snapshot,
    settings_snapshot,
    command_palette,
    file_search,
    notes_store_state,
    on_open_note,
    actions
  }: Props = $props()

  const palette_open = $derived(command_palette.snapshot.matches('open'))
  const palette_context = $derived(command_palette.snapshot.context)

  const file_search_open = $derived(file_search.snapshot.matches('open'))
  const file_search_context = $derived(file_search.snapshot.context)
  const recent_notes_for_display = $derived(
    file_search_context.recent_notes
      .map((id) => notes_store_state.notes.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => n != null)
  )

  const vault_dialog_open = $derived(
    has_vault &&
      (change_vault_snapshot.matches('dialog_open') ||
        change_vault_snapshot.matches('changing') ||
        change_vault_snapshot.matches('error'))
  )

  const delete_dialog_open = $derived(
    delete_note_snapshot.matches('confirming') ||
      delete_note_snapshot.matches('deleting') ||
      delete_note_snapshot.matches('error')
  )

  const rename_dialog_open = $derived(
    rename_note_snapshot.matches('confirming') ||
      rename_note_snapshot.matches('checking_conflict') ||
      rename_note_snapshot.matches('conflict_confirm') ||
      rename_note_snapshot.matches('renaming') ||
      rename_note_snapshot.matches('error')
  )

  const save_dialog_open = $derived(
    save_note_snapshot.context.requires_dialog &&
      (save_note_snapshot.matches('showing_save_dialog') ||
        save_note_snapshot.matches('checking_existence') ||
        save_note_snapshot.matches('conflict_confirm') ||
        save_note_snapshot.matches('saving') ||
        save_note_snapshot.matches('error'))
  )

  const settings_dialog_open = $derived(
    settings_snapshot.matches('loading') ||
      settings_snapshot.matches('editing') ||
      settings_snapshot.matches('saving') ||
      settings_snapshot.matches('error')
  )

  const create_folder_dialog_open = $derived(
    create_folder_snapshot.matches('dialog_open') ||
      create_folder_snapshot.matches('creating') ||
      create_folder_snapshot.matches('error')
  )
</script>

{#if has_vault}
  <VaultDialog
    open={vault_dialog_open}
    on_open_change={(open) => {
      if (!open) actions.close_change_vault_dialog()
    }}
    recent_vaults={vault_store_state.recent_vaults}
    current_vault_id={vault_store_state.vault!.id}
    is_loading={vault_selection_loading}
    error={change_vault_snapshot.context.error}
    on_choose_vault_dir={actions.choose_vault_dir}
    on_select_vault={actions.select_vault}
    hide_choose_vault_button={hide_choose_vault_button}
  />
{/if}

<DeleteNoteDialog
  open={delete_dialog_open}
  note={delete_note_snapshot.context.note_to_delete}
  is_deleting={delete_note_snapshot.matches('deleting')}
  error={delete_note_snapshot.context.error}
  on_confirm={actions.confirm_delete}
  on_cancel={actions.cancel_delete}
  on_retry={actions.retry_delete}
/>

<RenameNoteDialog
  open={rename_dialog_open}
  note={rename_note_snapshot.context.note_to_rename}
  new_path={rename_note_snapshot.context.new_path}
  is_renaming={rename_note_snapshot.matches('renaming')}
  is_checking_conflict={rename_note_snapshot.matches('checking_conflict')}
  error={rename_note_snapshot.context.error}
  show_overwrite_confirm={rename_note_snapshot.matches('conflict_confirm')}
  on_update_path={actions.update_rename_path}
  on_confirm={actions.confirm_rename}
  on_confirm_overwrite={actions.confirm_rename_overwrite}
  on_cancel={actions.cancel_rename}
  on_retry={actions.retry_rename}
/>

<DeleteFolderDialog snapshot={delete_folder.snapshot} send={delete_folder.send} />

<RenameFolderDialog snapshot={rename_folder.snapshot} send={rename_folder.send} />

<SaveNoteDialog
  open={save_dialog_open}
  new_path={save_note_snapshot.context.new_path}
  folder_path={save_note_snapshot.context.folder_path}
  is_saving={save_note_snapshot.matches('saving')}
  is_checking={save_note_snapshot.matches('checking_existence')}
  show_overwrite_confirm={save_note_snapshot.matches('conflict_confirm')}
  error={save_note_snapshot.context.error}
  on_update_path={actions.update_save_path}
  on_confirm={actions.confirm_save}
  on_confirm_overwrite={actions.confirm_save_overwrite}
  on_retry={actions.retry_save}
  on_cancel={actions.cancel_save}
/>

<SettingsDialog
  open={settings_dialog_open}
  editor_settings={settings_snapshot.context.current_settings}
  is_saving={settings_snapshot.matches('saving')}
  has_unsaved_changes={settings_snapshot.context.has_unsaved_changes}
  error={settings_snapshot.context.error}
  on_update_settings={actions.update_settings}
  on_save={actions.save_settings}
  on_close={actions.close_settings}
/>

<CreateFolderDialog
  open={create_folder_dialog_open}
  parent_path={create_folder_snapshot.context.parent_path}
  folder_name={create_folder_snapshot.context.folder_name}
  is_creating={create_folder_snapshot.matches('creating')}
  error={create_folder_snapshot.context.error}
  on_folder_name_change={actions.update_create_folder_name}
  on_confirm={actions.confirm_create_folder}
  on_cancel={actions.cancel_create_folder}
/>

<CommandPalette
  open={palette_open}
  query={palette_context.query}
  selected_index={palette_context.selected_index}
  on_open_change={(open) => {
    if (open) {
      command_palette.send({ type: 'OPEN' })
    } else {
      command_palette.send({ type: 'CLOSE' })
    }
  }}
  on_query_change={(query) => {
    command_palette.send({ type: 'SET_QUERY', query })
  }}
  on_selected_index_change={(index) => {
    command_palette.send({ type: 'SET_SELECTED_INDEX', index })
  }}
  on_select_command={(cmd) => {
    command_palette.send({ type: 'CLOSE' })
    switch (cmd) {
      case 'create_new_note':
        actions.create_new_note()
        break
      case 'change_vault':
        actions.request_change_vault()
        break
      case 'open_settings':
        actions.open_settings()
        break
      case 'open_file_search':
        file_search.send({ type: 'OPEN' })
        break
    }
  }}
  on_select_setting={(_key) => {
    command_palette.send({ type: 'CLOSE' })
    actions.open_settings()
  }}
/>

<FileSearchDialog
  open={file_search_open}
  query={file_search_context.query}
  results={file_search_context.results}
  recent_notes={recent_notes_for_display}
  selected_index={file_search_context.selected_index}
  is_searching={file_search_context.is_searching}
  on_open_change={(open) => {
    if (open) {
      file_search.send({ type: 'OPEN' })
    } else {
      file_search.send({ type: 'CLOSE' })
    }
  }}
  on_query_change={(query) => {
    file_search.send({ type: 'SET_QUERY', query })
  }}
  on_selected_index_change={(index) => {
    file_search.send({ type: 'SET_SELECTED_INDEX', index })
  }}
  on_confirm={(note_id) => {
    file_search.send({ type: 'ADD_RECENT', note_id })
    file_search.send({ type: 'CLOSE' })
    on_open_note(note_id)
  }}
/>
