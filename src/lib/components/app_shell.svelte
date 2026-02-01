<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import VaultDialog from '$lib/components/vault_dialog.svelte'
  import DeleteNoteDialog from '$lib/components/delete_note_dialog.svelte'
  import RenameNoteDialog from '$lib/components/rename_note_dialog.svelte'
  import DeleteFolderDialog from '$lib/components/delete_folder_dialog.svelte'
  import RenameFolderDialog from '$lib/components/rename_folder_dialog.svelte'
  import SaveNoteDialog from '$lib/components/save_note_dialog.svelte'
  import SettingsDialog from '$lib/components/settings_dialog.svelte'
  import CreateFolderDialog from '$lib/components/create_folder_dialog.svelte'
  import CommandPalette from '$lib/components/command_palette.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { VaultId, VaultPath } from '$lib/types/ids'
  import { as_markdown_text, as_note_path } from '$lib/types/ids'
  import type { NoteMeta } from '$lib/types/note'
  import { use_flow_handle } from '$lib/hooks/use_flow_handle.svelte'
  import { create_app_flows } from '$lib/flows/create_app_flows'
  import { create_editor_manager } from '$lib/operations/manage_editor'

  type Props = {
    ports: Ports
    bootstrap_default_vault_path?: VaultPath
    reset_state_on_mount?: boolean
    hide_choose_vault_button?: boolean
  }

  let { ports, bootstrap_default_vault_path, reset_state_on_mount = false, hide_choose_vault_button = false }: Props = $props()

  const stable = untrack(() => ({ ports, bootstrap_default_vault_path, reset_state_on_mount, hide_choose_vault_button }))

  const editor_manager = untrack(() => create_editor_manager(stable.ports.editor))
  const app = untrack(() => create_app_flows(stable.ports, {
    on_save_complete: () => editor_manager.mark_clean()
  }))

  const app_state = use_flow_handle(app.app_state)
  const app_startup = use_flow_handle(app.flows.app_startup)
  const open_app = use_flow_handle(app.flows.open_app)
  const change_vault = use_flow_handle(app.flows.change_vault)
  const open_note = use_flow_handle(app.flows.open_note)
  const delete_note = use_flow_handle(app.flows.delete_note)
  const rename_note = use_flow_handle(app.flows.rename_note)
  const delete_folder = use_flow_handle(app.flows.delete_folder)
  const rename_folder = use_flow_handle(app.flows.rename_folder)
  const save_note = use_flow_handle(app.flows.save_note)
  const create_folder = use_flow_handle(app.flows.create_folder)
  const settings = use_flow_handle(app.flows.settings)
  const command_palette = use_flow_handle(app.flows.command_palette)
  const filetree = use_flow_handle(app.flows.filetree)

  const palette_open = $derived(command_palette.snapshot.matches('open'))
  const palette_selected_index = $derived(command_palette.snapshot.context.selected_index)

  const vault_dialog_open = $derived(
    app_state.snapshot.matches('vault_open') &&
      (change_vault.snapshot.matches('dialog_open') ||
        change_vault.snapshot.matches('changing') ||
        change_vault.snapshot.matches('error'))
  )

  const delete_dialog_open = $derived(
    delete_note.snapshot.matches('confirming') ||
      delete_note.snapshot.matches('deleting') ||
      delete_note.snapshot.matches('error')
  )

  const rename_dialog_open = $derived(
    rename_note.snapshot.matches('confirming') ||
      rename_note.snapshot.matches('checking_conflict') ||
      rename_note.snapshot.matches('conflict_confirm') ||
      rename_note.snapshot.matches('renaming') ||
      rename_note.snapshot.matches('error')
  )

  const save_dialog_open = $derived(
    save_note.snapshot.matches('error')
  )

  const settings_dialog_open = $derived(
    settings.snapshot.matches('loading') ||
      settings.snapshot.matches('editing') ||
      settings.snapshot.matches('saving') ||
      settings.snapshot.matches('error')
  )

  const create_folder_dialog_open = $derived(
    create_folder.snapshot.matches('dialog_open') ||
      create_folder.snapshot.matches('creating') ||
      create_folder.snapshot.matches('error')
  )

  const delete_folder_dialog_open = $derived(
    delete_folder.snapshot.matches('fetching_stats') ||
      delete_folder.snapshot.matches('confirming') ||
      delete_folder.snapshot.matches('deleting') ||
      delete_folder.snapshot.matches('error')
  )

  const rename_folder_dialog_open = $derived(
    rename_folder.snapshot.matches('confirming') ||
      rename_folder.snapshot.matches('renaming') ||
      rename_folder.snapshot.matches('error')
  )

  const vault_selection_loading = $derived(
    open_app.snapshot.matches('starting') || change_vault.snapshot.matches('changing')
  )

  const actions = {
    mount() {
      app_startup.send({ type: 'INITIALIZE' })

      open_app.send({
        type: 'START',
        config: {
          reset_app_state: stable.reset_state_on_mount,
          bootstrap_default_vault_path: stable.bootstrap_default_vault_path ?? null
        }
      })
    },
    create_new_note() {
      app_state.send({ type: 'CREATE_NEW_NOTE_IN_CURRENT_FOLDER' })
    },
    request_change_vault() {
      change_vault.send({ type: 'OPEN_DIALOG' })
    },
    close_change_vault_dialog() {
      change_vault.send({ type: 'CLOSE_DIALOG' })
    },
    choose_vault_dir() {
      change_vault.send({ type: 'CHOOSE_VAULT' })
    },
    select_vault(vault_id: VaultId) {
      change_vault.send({ type: 'SELECT_VAULT', vault_id })
    },
    open_note(note_path: string) {
      const vault_id = app_state.snapshot.context.vault?.id
      if (!vault_id) return

      const current_note_id = app_state.snapshot.context.open_note?.meta.id
      if (current_note_id && current_note_id === as_note_path(note_path)) return

      open_note.send({ type: 'OPEN_NOTE', vault_id, note_path })
    },
    markdown_change(markdown: string) {
      app_state.send({ type: 'NOTIFY_MARKDOWN_CHANGED', markdown: as_markdown_text(markdown) })
    },
    dirty_state_change(is_dirty: boolean) {
      app_state.send({ type: 'NOTIFY_DIRTY_STATE_CHANGED', is_dirty })
    },
    request_delete(note: NoteMeta) {
      const vault_id = app_state.snapshot.context.vault?.id
      if (!vault_id) return
      const is_note_currently_open = app_state.snapshot.context.open_note?.meta.id === note.id
      delete_note.send({ type: 'REQUEST_DELETE', vault_id, note, is_note_currently_open })
    },
    confirm_delete() {
      delete_note.send({ type: 'CONFIRM' })
    },
    cancel_delete() {
      delete_note.send({ type: 'CANCEL' })
    },
    retry_delete() {
      delete_note.send({ type: 'RETRY' })
    },
    request_rename(note: NoteMeta) {
      const vault_id = app_state.snapshot.context.vault?.id
      if (!vault_id) return
      const is_note_currently_open = app_state.snapshot.context.open_note?.meta.id === note.id
      rename_note.send({ type: 'REQUEST_RENAME', vault_id, note, is_note_currently_open })
    },
    update_rename_path(path: string) {
      rename_note.send({ type: 'UPDATE_NEW_PATH', path: as_note_path(path) })
    },
    confirm_rename() {
      rename_note.send({ type: 'CONFIRM' })
    },
    confirm_rename_overwrite() {
      rename_note.send({ type: 'CONFIRM_OVERWRITE' })
    },
    cancel_rename() {
      rename_note.send({ type: 'CANCEL' })
    },
    retry_rename() {
      rename_note.send({ type: 'RETRY' })
    },
    request_save() {
      save_note.send({ type: 'REQUEST_SAVE' })
    },
    retry_save() {
      save_note.send({ type: 'RETRY' })
    },
    cancel_save() {
      save_note.send({ type: 'CANCEL' })
    },
    open_settings() {
      settings.send({ type: 'OPEN_DIALOG' })
    },
    close_settings() {
      settings.send({ type: 'CLOSE_DIALOG' })
    },
    update_settings(new_settings: import('$lib/types/editor_settings').EditorSettings) {
      settings.send({ type: 'UPDATE_SETTINGS', settings: new_settings })
    },
    save_settings() {
      settings.send({ type: 'SAVE' })
    },
    handle_theme_change(theme: 'light' | 'dark' | 'system') {
      stable.ports.theme.set_theme(theme)
      app_state.send({ type: 'SET_THEME', theme })
    },
    request_create_folder(parent_path: string) {
      const vault_id = app_state.snapshot.context.vault?.id
      if (!vault_id) return
      create_folder.send({ type: 'REQUEST_CREATE', vault_id, parent_path })
    },
    confirm_create_folder() {
      create_folder.send({ type: 'CONFIRM' })
    },
    cancel_create_folder() {
      create_folder.send({ type: 'CANCEL' })
    },
    update_create_folder_name(name: string) {
      create_folder.send({ type: 'UPDATE_FOLDER_NAME', name })
    },
    toggle_sidebar() {
      app_state.send({ type: 'TOGGLE_SIDEBAR' })
    },
    select_folder_path(path: string) {
      app_state.send({ type: 'SET_SELECTED_FOLDER_PATH', path })
    },
    toggle_filetree_folder(path: string) {
      filetree.send({ type: 'TOGGLE_FOLDER', path })
    },
    retry_load_folder(path: string) {
      filetree.send({ type: 'RETRY_LOAD', path })
    },
    collapse_all_folders() {
      filetree.send({ type: 'COLLAPSE_ALL' })
    },
    request_delete_folder(folder_path: string) {
      const vault_id = app_state.snapshot.context.vault?.id
      if (!vault_id) return

      const open_note_path = app_state.snapshot.context.open_note?.meta.path ?? ''
      const prefix = folder_path + '/'
      const contains_open_note = open_note_path.startsWith(prefix)

      delete_folder.send({
        type: 'REQUEST_DELETE',
        vault_id,
        folder_path,
        contains_open_note
      })
    },
    request_rename_folder(folder_path: string) {
      const vault_id = app_state.snapshot.context.vault?.id
      if (!vault_id) return
      rename_folder.send({ type: 'REQUEST_RENAME', vault_id, folder_path })
    }
  }


  function handle_keydown_capture(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
      if (app_state.snapshot.matches('no_vault')) {
        return
      }
      event.preventDefault()
      command_palette.send({ type: 'TOGGLE' })
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
      if (app_state.snapshot.matches('no_vault')) {
        return
      }
      event.preventDefault()
      actions.toggle_sidebar()
    }
  }

  function handle_keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      actions.request_save()
    }
  }

  onMount(() => {
    actions.mount()
  })
</script>

{#if app_state.snapshot.matches('no_vault')}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel
      recent_vaults={app_state.snapshot.context.recent_vaults}
      current_vault_id={null}
      is_loading={vault_selection_loading}
      error={open_app.snapshot.context.error ?? change_vault.snapshot.context.error}
      on_choose_vault_dir={actions.choose_vault_dir}
      on_select_vault={actions.select_vault}
      hide_choose_vault_button={stable.hide_choose_vault_button}
    />
  </div>
{:else}
  {@const app = app_state.snapshot.context}
  <main>
    <AppSidebar
      editor_manager={editor_manager}
      vault={app.vault}
      notes={app.notes}
      folder_paths={app.folder_paths}
      expanded_paths={filetree.snapshot.context.expanded_paths}
      load_states={filetree.snapshot.context.load_states}
      open_note_title={app.open_note?.meta.title ?? 'Notes'}
      open_note={app.open_note}
      sidebar_open={app.sidebar_open}
      selected_folder_path={app.selected_folder_path}
      current_theme={app.theme}
      on_theme_change={actions.handle_theme_change}
      on_open_note={actions.open_note}
      on_create_note={actions.create_new_note}
      on_request_create_folder={actions.request_create_folder}
      on_markdown_change={actions.markdown_change}
      on_dirty_state_change={actions.dirty_state_change}
      on_request_delete_note={actions.request_delete}
      on_request_rename_note={actions.request_rename}
      on_request_delete_folder={actions.request_delete_folder}
      on_request_rename_folder={actions.request_rename_folder}
      on_open_settings={actions.open_settings}
      on_toggle_sidebar={actions.toggle_sidebar}
      on_select_folder_path={actions.select_folder_path}
      on_toggle_folder={actions.toggle_filetree_folder}
      on_retry_load={actions.retry_load_folder}
      on_collapse_all={actions.collapse_all_folders}
    />
  </main>
{/if}

{#if app_state.snapshot.matches('vault_open')}
  {@const app = app_state.snapshot.context}
  <VaultDialog
    open={vault_dialog_open}
    on_open_change={(open) => {
      if (!open) actions.close_change_vault_dialog()
    }}
    recent_vaults={app.recent_vaults}
    current_vault_id={app.vault!.id}
    is_loading={vault_selection_loading}
    error={change_vault.snapshot.context.error}
    on_choose_vault_dir={actions.choose_vault_dir}
    on_select_vault={actions.select_vault}
    hide_choose_vault_button={stable.hide_choose_vault_button}
  />
{/if}

<DeleteNoteDialog
  open={delete_dialog_open}
  note={delete_note.snapshot.context.note_to_delete}
  is_deleting={delete_note.snapshot.matches('deleting')}
  error={delete_note.snapshot.context.error}
  on_confirm={actions.confirm_delete}
  on_cancel={actions.cancel_delete}
  on_retry={actions.retry_delete}
/>

<RenameNoteDialog
  open={rename_dialog_open}
  note={rename_note.snapshot.context.note_to_rename}
  new_path={rename_note.snapshot.context.new_path}
  is_renaming={rename_note.snapshot.matches('renaming')}
  is_checking_conflict={rename_note.snapshot.matches('checking_conflict')}
  error={rename_note.snapshot.context.error}
  show_overwrite_confirm={rename_note.snapshot.matches('conflict_confirm')}
  on_update_path={actions.update_rename_path}
  on_confirm={actions.confirm_rename}
  on_confirm_overwrite={actions.confirm_rename_overwrite}
  on_cancel={actions.cancel_rename}
  on_retry={actions.retry_rename}
/>

<DeleteFolderDialog
  snapshot={delete_folder.snapshot}
  send={delete_folder.send}
/>

<RenameFolderDialog
  snapshot={rename_folder.snapshot}
  send={rename_folder.send}
/>

<SaveNoteDialog
  open={save_dialog_open}
  is_saving={save_note.snapshot.matches('saving')}
  error={save_note.snapshot.context.error}
  on_retry={actions.retry_save}
  on_cancel={actions.cancel_save}
/>

<SettingsDialog
  open={settings_dialog_open}
  editor_settings={settings.snapshot.context.current_settings}
  is_saving={settings.snapshot.matches('saving')}
  has_unsaved_changes={settings.snapshot.context.has_unsaved_changes}
  error={settings.snapshot.context.error}
  on_update_settings={actions.update_settings}
  on_save={actions.save_settings}
  on_close={actions.close_settings}
/>

<CreateFolderDialog
  open={create_folder_dialog_open}
  parent_path={create_folder.snapshot.context.parent_path}
  folder_name={create_folder.snapshot.context.folder_name}
  is_creating={create_folder.snapshot.matches('creating')}
  error={create_folder.snapshot.context.error}
  on_folder_name_change={actions.update_create_folder_name}
  on_confirm={actions.confirm_create_folder}
  on_cancel={actions.cancel_create_folder}
/>

<CommandPalette
  open={palette_open}
  on_open_change={(open) => {
    if (open) {
      command_palette.send({ type: 'OPEN' })
    } else {
      command_palette.send({ type: 'CLOSE' })
    }
  }}
  selected_index={palette_selected_index}
  on_selected_index_change={(index) => { command_palette.send({ type: 'SET_SELECTED_INDEX', index }) }}
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
    }
  }}
/>

<svelte:window onkeydowncapture={handle_keydown_capture} onkeydown={handle_keydown} />
