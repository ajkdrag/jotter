<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_home_host } from '$lib/hosts/home_host'
  import { reset_app_state_for_backend_switch } from '$lib/hosts/reset_app_state_for_backend_switch'
  import { as_vault_path } from '$lib/types/ids'

  let host: ReturnType<typeof create_home_host> | undefined = $state()

  onMount(async () => {
    reset_app_state_for_backend_switch(app_state)
    const ports = create_test_ports()
    host = create_home_host({ ports, state: app_state })
    if (!app_state.vault) {
      const hardcoded_path = as_vault_path('test-vault')
      await host.bootstrap_default_vault(hardcoded_path)
    }
  })

  $effect(() => {
    if (host) {
      const _vault = host.vault
      const _notes = host.notes
      const _open_note = host.open_note
      host.ensure_open_note()
    }
  })
</script>

{#if host}
  {@const h = host}
  {#if h.vault}
    <main>
      <AppSidebar
        vault={h.vault}
        notes={h.notes}
        open_note_title={h.open_note?.meta.title ?? "Notes"}
        is_vault_dialog_open={h.vault_dialog_open}
        open_note={h.open_note}
        onOpenNote={(note_path) => void h.on_open_note(note_path)}
        onRequestChangeVault={h.on_request_change_vault}
        onMarkdownChange={h.on_markdown_change}
      />
    </main>
  {:else}
    <div class="flex items-center justify-center min-h-screen">
      <p class="text-muted-foreground">Loading test vault...</p>
    </div>
  {/if}
{/if}
