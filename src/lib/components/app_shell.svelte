<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import AppShellDialogs from '$lib/components/app_shell_dialogs.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { VaultPath } from '$lib/types/ids'
  import { use_flow_handle } from '$lib/hooks/use_flow_handle.svelte'
  import { use_store_handle } from '$lib/hooks/use_store_handle.svelte'
  import { use_keyboard_shortcuts } from '$lib/hooks/use_keyboard_shortcuts.svelte'
  import { create_app_flows } from '$lib/flows/create_app_flows'
  import { create_editor_manager } from '$lib/operations/manage_editor'
  import { create_app_shell_actions } from '$lib/components/app_shell_actions'
  import { build_app_sidebar_props } from '$lib/components/app_sidebar_view_model'

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

  const vault_store = use_store_handle(app.stores.vault)
  const notes_store = use_store_handle(app.stores.notes)
  const editor_store = use_store_handle(app.stores.editor)
  const ui_store = use_store_handle(app.stores.ui)

  const open_app = use_flow_handle(app.flows.open_app)
  const change_vault = use_flow_handle(app.flows.change_vault)
  const delete_note = use_flow_handle(app.flows.delete_note)
  const rename_note = use_flow_handle(app.flows.rename_note)
  const delete_folder = use_flow_handle(app.flows.delete_folder)
  const rename_folder = use_flow_handle(app.flows.rename_folder)
  const save_note = use_flow_handle(app.flows.save_note)
  const create_folder = use_flow_handle(app.flows.create_folder)
  const settings = use_flow_handle(app.flows.settings)
  const command_palette = use_flow_handle(app.flows.command_palette)
  const file_search = use_flow_handle(app.flows.file_search)
  const filetree = use_flow_handle(app.flows.filetree)

  const has_vault = $derived(vault_store.state.vault !== null)

  const vault_selection_loading = $derived(
    open_app.snapshot.matches('starting') || change_vault.snapshot.matches('changing')
  )

  const actions = create_app_shell_actions({
    stable: {
      ports: stable.ports,
      reset_state_on_mount: stable.reset_state_on_mount,
      ...(stable.bootstrap_default_vault_path !== undefined
        ? { bootstrap_default_vault_path: stable.bootstrap_default_vault_path }
        : {})
    },
    app
  })

  const keyboard = use_keyboard_shortcuts({
    is_enabled: () => has_vault,
    on_toggle_palette: () => {
      command_palette.send({ type: 'TOGGLE' })
    },
    on_toggle_file_search: () => {
      file_search.send({ type: 'TOGGLE' })
    },
    on_toggle_sidebar: actions.toggle_sidebar,
    on_save: actions.request_save
  })

  onMount(() => {
    actions.mount()
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
	    actions
	  }))
</script>

{#if !has_vault}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel
      recent_vaults={vault_store.state.recent_vaults}
      current_vault_id={null}
      is_loading={vault_selection_loading}
      error={open_app.snapshot.context.error ?? change_vault.snapshot.context.error}
      on_choose_vault_dir={actions.choose_vault_dir}
      on_select_vault={actions.select_vault}
      hide_choose_vault_button={stable.hide_choose_vault_button}
    />
  </div>
{:else}
  <main>
    <AppSidebar model={sidebar_props.model} ops={sidebar_props.ops} />
  </main>
{/if}

<AppShellDialogs
  has_vault={has_vault}
  hide_choose_vault_button={stable.hide_choose_vault_button}
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
  on_open_note={actions.open_note}
  actions={actions}
/>

<svelte:window onkeydowncapture={keyboard.handle_keydown_capture} onkeydown={keyboard.handle_keydown} />
