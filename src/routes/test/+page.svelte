<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import { test_ports } from '$lib/adapters/test/test_ports'
  import { ports } from '$lib/adapters/ports'
  import { change_vault } from '$lib/operations/change_vault'
  import { as_vault_path } from '$lib/types/ids'
  import { ensure_watching } from '$lib/workflows/watcher_session'

  const original_ports = {
    vault: ports.vault,
    notes: ports.notes,
    index: ports.index,
    watcher: ports.watcher,
    settings: ports.settings,
    assets: ports.assets,
    telemetry: ports.telemetry,
    navigation: ports.navigation
  }

  onMount(async () => {
    ports.vault = test_ports.vault
    ports.notes = test_ports.notes
    ports.index = test_ports.index
    ports.watcher = test_ports.watcher
    ports.settings = test_ports.settings
    ports.assets = test_ports.assets
    ports.telemetry = test_ports.telemetry
    ports.navigation = test_ports.navigation

    if (!app_state.vault) {
      const hardcoded_path = as_vault_path('test-vault')
      const result = await change_vault(ports, { vault_path: hardcoded_path })
      app_state.vault = result.vault
      app_state.notes = result.notes
      app_state.open_note = null
      app_state.search_results = []
      app_state.conflict = null
      await ensure_watching(result.vault.id)
      void ports.index.build_index(result.vault.id)
    }
  })

  onDestroy(() => {
    ports.vault = original_ports.vault
    ports.notes = original_ports.notes
    ports.index = original_ports.index
    ports.watcher = original_ports.watcher
    ports.settings = original_ports.settings
    ports.assets = original_ports.assets
    ports.telemetry = original_ports.telemetry
    ports.navigation = original_ports.navigation
  })
</script>

{#if app_state.vault}
  <main>
    <AppSidebar />
  </main>
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-muted-foreground">Loading test vault...</p>
  </div>
{/if}
