<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_home_host } from '$lib/hosts/home_host'
  import { reset_app_state_for_backend_switch } from '$lib/hosts/reset_app_state_for_backend_switch'
  import { change_vault } from '$lib/operations/change_vault'
  import { as_vault_path } from '$lib/types/ids'
  import { ensure_watching } from '$lib/workflows/watcher_session'

  const ports = create_test_ports()
  const host = create_home_host({ ports, state: app_state })

  const window_scheduler = {
    setTimeout: (fn: () => void, delay: number) => window.setTimeout(fn, delay),
    clearTimeout: (id: number | null) => {
      if (id != null) window.clearTimeout(id)
    }
  }

  $effect(() => {
    const _vault = host.vault
    const _notes = host.notes
    const _open_note = host.open_note
    host.ensure_open_note()
  })

  onMount(async () => {
    reset_app_state_for_backend_switch(app_state)
    if (!app_state.vault) {
      const hardcoded_path = as_vault_path('test-vault')
      const result = await change_vault(ports, { vault_path: hardcoded_path })
      app_state.vault = result.vault
      app_state.notes = result.notes
      app_state.open_note = null
      await ensure_watching(result.vault.id, window_scheduler)
      void ports.index.build_index(result.vault.id)
    }
  })
</script>

{#if host.vault}
  <main>
    <AppSidebar
      vault={host.vault}
      notes={host.notes}
      open_note_title={host.open_note?.meta.title ?? "Notes"}
      is_vault_dialog_open={host.vault_dialog_open}
      open_note={host.open_note}
      onOpenNote={(note_path) => void host.on_open_note(note_path)}
      onRequestChangeVault={host.on_request_change_vault}
      onMarkdownChange={host.on_markdown_change}
    />
  </main>
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-muted-foreground">Loading test vault...</p>
  </div>
{/if}
