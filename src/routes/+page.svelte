<script lang="ts">
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import AppSidebar from "$lib/components/app_sidebar.svelte";
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte";
</script>

{#if !app_state.vault}
  <VaultSelectionPanel />
{:else}
  <main>
    <AppSidebar />
  </main>
{/if}


