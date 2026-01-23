<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import VaultDialog from '$lib/components/vault_dialog.svelte'
  import DeleteNoteDialog from '$lib/components/delete_note_dialog.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { NoteMeta } from '$lib/types/note'
  import type { VaultId, VaultPath } from '$lib/types/ids'
  import { as_markdown_text } from '$lib/types/ids'
  import { use_xstate_machine } from '$lib/hooks/use_xstate_machine.svelte'
  import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'
  import { open_note_flow_machine } from '$lib/flows/open_note_flow'
  import { delete_note_flow_machine } from '$lib/flows/delete_note_flow'
  import { reset_app_state_for_backend_switch } from '$lib/utils/reset_app_state_for_backend_switch'

  type Props = {
    ports: Ports
    bootstrap_default_vault_path?: VaultPath
    reset_state_on_mount?: boolean
  }

  let { ports, bootstrap_default_vault_path, reset_state_on_mount = false }: Props = $props()

  const stable_ports = untrack(() => ports)

  const change_vault = use_xstate_machine(change_vault_flow_machine, {
    input: {
      ports: {
        vault: stable_ports.vault,
        notes: stable_ports.notes,
        index: stable_ports.index,
        navigation: stable_ports.navigation
      },
      app_state
    }
  })

  const open_note = use_xstate_machine(open_note_flow_machine, {
    input: {
      ports: { notes: stable_ports.notes },
      app_state
    }
  })

  const delete_note = use_xstate_machine(delete_note_flow_machine, {
    input: {
      ports: { notes: stable_ports.notes, index: stable_ports.index },
      app_state
    }
  })

  onMount(() => {
    if (reset_state_on_mount) reset_app_state_for_backend_switch(app_state)
    change_vault.actor.send({ type: 'LOAD_RECENT' })
    if (bootstrap_default_vault_path && !app_state.vault) {
      change_vault.actor.send({ type: 'BOOTSTRAP_DEFAULT_VAULT', vault_path: bootstrap_default_vault_path })
    }
  })

  const vault_dialog_open = $derived(
    !!app_state.vault &&
      (change_vault.snapshot.matches('dialog_open') ||
        change_vault.snapshot.matches('changing') ||
        change_vault.snapshot.matches('error'))
  )

  const delete_dialog_open = $derived(
    delete_note.snapshot.matches('confirming') ||
      delete_note.snapshot.matches('deleting') ||
      delete_note.snapshot.matches('error')
  )

  const change_vault_loading = $derived(
    change_vault.snapshot.matches('loading_recent') || change_vault.snapshot.matches('changing')
  )

  function request_change_vault() {
    change_vault.actor.send({ type: 'OPEN_DIALOG' })
  }

  function close_change_vault_dialog() {
    change_vault.actor.send({ type: 'CLOSE_DIALOG' })
  }

  function choose_vault_dir() {
    change_vault.actor.send({ type: 'CHOOSE_VAULT' })
  }

  function select_vault(vault_id: VaultId) {
    change_vault.actor.send({ type: 'SELECT_VAULT', vault_id })
  }

  function open_note_path(note_path: string) {
    open_note.actor.send({ type: 'OPEN_NOTE', note_path })
  }

  function markdown_change(markdown: string) {
    if (!app_state.open_note) return
    app_state.open_note.markdown = as_markdown_text(markdown)
  }

  function request_delete(note: NoteMeta) {
    delete_note.actor.send({ type: 'REQUEST_DELETE', note })
  }

  function confirm_delete() {
    delete_note.actor.send({ type: 'CONFIRM' })
  }

  function cancel_delete() {
    delete_note.actor.send({ type: 'CANCEL' })
  }

  function retry_delete() {
    delete_note.actor.send({ type: 'RETRY' })
  }
</script>

{#if !app_state.vault}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel
      recent_vaults={app_state.recent_vaults}
      current_vault_id={null}
      is_loading={change_vault_loading}
      error={change_vault.snapshot.context.error}
      onChooseVaultDir={choose_vault_dir}
      onSelectVault={select_vault}
    />
  </div>
{:else}
  <main>
    <AppSidebar
      vault={app_state.vault}
      notes={app_state.notes}
      open_note_title={app_state.open_note?.meta.title ?? 'Notes'}
      open_note={app_state.open_note}
      onOpenNote={open_note_path}
      onRequestChangeVault={request_change_vault}
      onMarkdownChange={markdown_change}
      onRequestDeleteNote={request_delete}
    />
  </main>
{/if}

{#if app_state.vault}
  <VaultDialog
    open={vault_dialog_open}
    onOpenChange={(open) => {
      if (!open) close_change_vault_dialog()
    }}
    recent_vaults={app_state.recent_vaults}
    current_vault_id={app_state.vault.id}
    is_loading={change_vault_loading}
    error={change_vault.snapshot.context.error}
    onChooseVaultDir={choose_vault_dir}
    onSelectVault={select_vault}
  />
{/if}

<DeleteNoteDialog
  open={delete_dialog_open}
  note={delete_note.snapshot.context.note_to_delete}
  is_deleting={delete_note.snapshot.matches('deleting')}
  error={delete_note.snapshot.context.error}
  onConfirm={confirm_delete}
  onCancel={cancel_delete}
  onRetry={retry_delete}
/>
