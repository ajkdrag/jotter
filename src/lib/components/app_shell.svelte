<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import VaultDialog from '$lib/components/vault_dialog.svelte'
  import DeleteNoteDialog from '$lib/components/delete_note_dialog.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { VaultId, VaultPath } from '$lib/types/ids'
  import { as_markdown_text } from '$lib/types/ids'
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

  const model = use_flow_handle(app.model)
  const change_vault = use_flow_handle(app.flows.change_vault)
  const open_note = use_flow_handle(app.flows.open_note)
  const delete_note = use_flow_handle(app.flows.delete_note)

  const vault_dialog_open = $derived(
    model.snapshot.matches('vault_open') &&
      (change_vault.snapshot.matches('dialog_open') ||
        change_vault.snapshot.matches('changing') ||
        change_vault.snapshot.matches('error'))
  )

  const delete_dialog_open = $derived(
    delete_note.snapshot.matches('confirming') ||
      delete_note.snapshot.matches('deleting') ||
      delete_note.snapshot.matches('error')
  )

  const vault_selection_loading = $derived(
    change_vault.snapshot.matches('loading_recent') || change_vault.snapshot.matches('changing')
  )

  const actions = {
    mount() {
      if (stable.reset_state_on_mount) model.send({ type: 'RESET' })
      change_vault.send({ type: 'LOAD_RECENT' })

      if (stable.bootstrap_default_vault_path && model.snapshot.matches('no_vault')) {
        change_vault.send({ type: 'BOOTSTRAP_DEFAULT_VAULT', vault_path: stable.bootstrap_default_vault_path })
      }
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
      const vault_id = model.snapshot.context.vault?.id
      if (!vault_id) return
      open_note.send({ type: 'OPEN_NOTE', vault_id, note_path })
    },
    markdown_change(markdown: string) {
      model.send({ type: 'OPEN_NOTE_MARKDOWN_CHANGED', markdown: as_markdown_text(markdown) })
    },
    request_delete(note: NoteMeta) {
      const vault_id = model.snapshot.context.vault?.id
      if (!vault_id) return
      const is_note_currently_open = model.snapshot.context.open_note?.meta.id === note.id
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
    }
  }

  onMount(() => {
    actions.mount()
  })
</script>

{#if model.snapshot.matches('no_vault')}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel
      recent_vaults={model.snapshot.context.recent_vaults}
      current_vault_id={null}
      is_loading={vault_selection_loading}
      error={change_vault.snapshot.context.error}
      onChooseVaultDir={actions.choose_vault_dir}
      onSelectVault={actions.select_vault}
      hide_choose_vault_button={stable.hide_choose_vault_button}
    />
  </div>
{:else}
  {@const app = model.snapshot.context}
  <main>
    <AppSidebar
      vault={app.vault}
      notes={app.notes}
      open_note_title={app.open_note?.meta.title ?? 'Notes'}
      open_note={app.open_note}
      onOpenNote={actions.open_note}
      onRequestChangeVault={actions.request_change_vault}
      onMarkdownChange={actions.markdown_change}
      onRequestDeleteNote={actions.request_delete}
    />
  </main>
{/if}

{#if model.snapshot.matches('vault_open')}
  {@const app = model.snapshot.context}
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
