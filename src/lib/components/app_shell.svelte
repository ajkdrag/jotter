<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import VaultDialog from '$lib/components/vault_dialog.svelte'
  import DeleteNoteDialog from '$lib/components/delete_note_dialog.svelte'
  import RenameNoteDialog from '$lib/components/rename_note_dialog.svelte'
  import SaveNoteDialog from '$lib/components/save_note_dialog.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { NoteId, VaultId, VaultPath } from '$lib/types/ids'
  import { as_markdown_text, as_note_path } from '$lib/types/ids'
  import type { NoteMeta } from '$lib/types/note'
  import { use_flow_handle } from '$lib/hooks/use_flow_handle.svelte'
  import { create_app_flows } from '$lib/flows/create_app_flows'

  type Props = {
    ports: Ports
    bootstrap_default_vault_path?: VaultPath
    reset_state_on_mount?: boolean
    hide_choose_vault_button?: boolean
  }

  let { ports, bootstrap_default_vault_path, reset_state_on_mount = false, hide_choose_vault_button = false }: Props = $props()

  const stable = untrack(() => ({ ports, bootstrap_default_vault_path, reset_state_on_mount, hide_choose_vault_button }))

  const app = untrack(() => create_app_flows(stable.ports))

  const app_state = use_flow_handle(app.app_state)
  const open_app = use_flow_handle(app.flows.open_app)
  const change_vault = use_flow_handle(app.flows.change_vault)
  const open_note = use_flow_handle(app.flows.open_note)
  const delete_note = use_flow_handle(app.flows.delete_note)
  const rename_note = use_flow_handle(app.flows.rename_note)
  const save_note = use_flow_handle(app.flows.save_note)

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

  const vault_selection_loading = $derived(
    open_app.snapshot.matches('starting') || change_vault.snapshot.matches('changing')
  )

  const actions = {
    mount() {
      open_app.send({
        type: 'START',
        config: {
          reset_app_state: stable.reset_state_on_mount,
          bootstrap_default_vault_path: stable.bootstrap_default_vault_path ?? null
        }
      })
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
    revision_change(args: { note_id: NoteId; revision_id: number; sticky_dirty: boolean }) {
      app_state.send({
        type: 'NOTIFY_REVISION_CHANGED',
        note_id: args.note_id,
        revision_id: args.revision_id,
        sticky_dirty: args.sticky_dirty
      })
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
      onChooseVaultDir={actions.choose_vault_dir}
      onSelectVault={actions.select_vault}
      hide_choose_vault_button={stable.hide_choose_vault_button}
    />
  </div>
{:else}
  {@const app = app_state.snapshot.context}
  <main>
    <AppSidebar
      vault={app.vault}
      notes={app.notes}
      open_note_title={app.open_note?.meta.title ?? 'Notes'}
      open_note={app.open_note}
      on_open_note={actions.open_note}
      on_request_change_vault={actions.request_change_vault}
      on_markdown_change={actions.markdown_change}
      on_revision_change={actions.revision_change}
      on_request_delete_note={actions.request_delete}
      on_request_rename_note={actions.request_rename}
    />
  </main>
{/if}

{#if app_state.snapshot.matches('vault_open')}
  {@const app = app_state.snapshot.context}
  <VaultDialog
    open={vault_dialog_open}
    onOpenChange={(open) => {
      if (!open) actions.close_change_vault_dialog()
    }}
    recent_vaults={app.recent_vaults}
    current_vault_id={app.vault!.id}
    is_loading={vault_selection_loading}
    error={change_vault.snapshot.context.error}
    onChooseVaultDir={actions.choose_vault_dir}
    onSelectVault={actions.select_vault}
    hide_choose_vault_button={stable.hide_choose_vault_button}
  />
{/if}

<DeleteNoteDialog
  open={delete_dialog_open}
  note={delete_note.snapshot.context.note_to_delete}
  is_deleting={delete_note.snapshot.matches('deleting')}
  error={delete_note.snapshot.context.error}
  onConfirm={actions.confirm_delete}
  onCancel={actions.cancel_delete}
  onRetry={actions.retry_delete}
/>

<RenameNoteDialog
  open={rename_dialog_open}
  note={rename_note.snapshot.context.note_to_rename}
  new_path={rename_note.snapshot.context.new_path}
  is_renaming={rename_note.snapshot.matches('renaming')}
  is_checking_conflict={rename_note.snapshot.matches('checking_conflict')}
  error={rename_note.snapshot.context.error}
  show_overwrite_confirm={rename_note.snapshot.matches('conflict_confirm')}
  onUpdatePath={actions.update_rename_path}
  onConfirm={actions.confirm_rename}
  onConfirmOverwrite={actions.confirm_rename_overwrite}
  onCancel={actions.cancel_rename}
  onRetry={actions.retry_rename}
/>

<SaveNoteDialog
  open={save_dialog_open}
  is_saving={save_note.snapshot.matches('saving')}
  error={save_note.snapshot.context.error}
  onRetry={actions.retry_save}
  onCancel={actions.cancel_save}
/>

<svelte:window onkeydown={handle_keydown} />
