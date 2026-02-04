<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import AppShellDialogs from '$lib/components/app_shell_dialogs.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import { use_flow_handle } from '$lib/hooks/use_flow_handle.svelte'
  import { use_store_handle } from '$lib/hooks/use_store_handle.svelte'
  import { use_keyboard_shortcuts } from '$lib/hooks/use_keyboard_shortcuts.svelte'
  import { build_app_sidebar_props } from '$lib/components/app_sidebar_view_model'
  import type { AppFlows } from '$lib/flows/create_app_flows'
  import type { EditorManager } from '$lib/adapters/editor/editor_manager'
  import type { AppShellActions } from '$lib/controllers/app_shell_actions'

  type Props = {
    app: AppFlows
    editor_manager: EditorManager
    actions: AppShellActions
    hide_choose_vault_button?: boolean
  }

  let { app, editor_manager, actions, hide_choose_vault_button = false }: Props = $props()

  const stable_app = untrack(() => app)
  const stable_actions = untrack(() => actions)

  const vault_store = use_store_handle(stable_app.stores.vault)
  const notes_store = use_store_handle(stable_app.stores.notes)
  const editor_store = use_store_handle(stable_app.stores.editor)
  const ui_store = use_store_handle(stable_app.stores.ui)

  const open_app = use_flow_handle(stable_app.flows.open_app)
  const change_vault = use_flow_handle(stable_app.flows.change_vault)
  const delete_note = use_flow_handle(stable_app.flows.delete_note)
  const rename_note = use_flow_handle(stable_app.flows.rename_note)
  const delete_folder = use_flow_handle(stable_app.flows.delete_folder)
  const rename_folder = use_flow_handle(stable_app.flows.rename_folder)
  const save_note = use_flow_handle(stable_app.flows.save_note)
  const create_folder = use_flow_handle(stable_app.flows.create_folder)
  const settings = use_flow_handle(stable_app.flows.settings)
  const command_palette = use_flow_handle(stable_app.flows.command_palette)
  const file_search = use_flow_handle(stable_app.flows.file_search)
  const filetree = use_flow_handle(stable_app.flows.filetree)

  const has_vault = $derived(vault_store.state.vault !== null)

  const palette_open = $derived(command_palette.snapshot.matches('open'))
  const file_search_open = $derived(file_search.snapshot.matches('open'))

  const vault_dialog_open = $derived(
    has_vault &&
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
    save_note.snapshot.context.requires_dialog &&
      (save_note.snapshot.matches('showing_save_dialog') ||
        save_note.snapshot.matches('checking_existence') ||
        save_note.snapshot.matches('conflict_confirm') ||
        save_note.snapshot.matches('saving') ||
        save_note.snapshot.matches('error'))
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

  const any_blocking_dialog_open = $derived(
    ui_store.state.system_dialog_open ||
      vault_dialog_open ||
      delete_dialog_open ||
      rename_dialog_open ||
      save_dialog_open ||
      settings_dialog_open ||
      create_folder_dialog_open ||
      delete_folder_dialog_open ||
      rename_folder_dialog_open
  )

  const vault_selection_loading = $derived(
    open_app.snapshot.matches('starting') || change_vault.snapshot.matches('changing')
  )

  const keyboard = use_keyboard_shortcuts({
    is_enabled: () => has_vault,
    is_blocked: () => any_blocking_dialog_open || palette_open || file_search_open,
    is_palette_open: () => palette_open,
    is_file_search_open: () => file_search_open,
    on_toggle_palette: () => {
      command_palette.send({ type: 'TOGGLE' })
    },
    on_toggle_file_search: () => {
      file_search.send({ type: 'TOGGLE' })
    },
    on_toggle_sidebar: stable_actions.toggle_sidebar,
    on_save: stable_actions.request_save
  })

  onMount(() => {
    stable_actions.mount()
  })

  const sidebar_props = $derived(build_app_sidebar_props({
    editor_manager,
    vault: vault_store.state.vault,
    notes: notes_store.state.notes,
    folder_paths: notes_store.state.folder_paths,
    expanded_paths: filetree.snapshot.context.expanded_paths,
    load_states: filetree.snapshot.context.load_states,
    open_note_title: editor_store.state.open_note?.meta.title ?? 'Notes',
    open_note: editor_store.state.open_note,
    sidebar_open: ui_store.state.sidebar_open,
    selected_folder_path: ui_store.state.selected_folder_path,
    current_theme: ui_store.state.theme,
    link_syntax: ui_store.state.editor_settings.link_syntax,
    actions: stable_actions
  }))
</script>

{#if !has_vault}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel
      recent_vaults={vault_store.state.recent_vaults}
      current_vault_id={null}
      is_loading={vault_selection_loading}
      error={open_app.snapshot.context.error ?? change_vault.snapshot.context.error}
      on_choose_vault_dir={stable_actions.choose_vault_dir}
      on_select_vault={stable_actions.select_vault}
      hide_choose_vault_button={hide_choose_vault_button}
    />
  </div>
{:else}
  <main>
    <AppSidebar model={sidebar_props.model} ops={sidebar_props.ops} />
  </main>
{/if}

<AppShellDialogs
  has_vault={has_vault}
  hide_choose_vault_button={hide_choose_vault_button}
  vault_selection_loading={vault_selection_loading}
  vault_store_state={vault_store.state}
  change_vault_snapshot={change_vault.snapshot}
  delete_note_snapshot={delete_note.snapshot}
  rename_note_snapshot={rename_note.snapshot}
  save_note_snapshot={save_note.snapshot}
  delete_folder={delete_folder}
  rename_folder={rename_folder}
  create_folder_snapshot={create_folder.snapshot}
  settings_snapshot={settings.snapshot}
  command_palette={command_palette}
  file_search={file_search}
  notes_store_state={notes_store.state}
  on_open_note={stable_actions.open_note}
  actions={stable_actions}
/>

<svelte:window onkeydowncapture={keyboard.handle_keydown_capture} onkeydown={keyboard.handle_keydown} />
