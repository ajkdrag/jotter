<script lang="ts">
  import { onMount } from "svelte";
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import AppSidebar from "$lib/components/app_sidebar.svelte";
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { reset_app_state_for_backend_switch } from "$lib/hosts/reset_app_state_for_backend_switch";
  import { create_home_host } from "$lib/hosts/home_host";

  const ports = create_prod_ports();
  const host = create_home_host({ ports, state: app_state });

  onMount(() => {
    reset_app_state_for_backend_switch(app_state);
  });

  $effect(() => {
    const _vault = host.vault;
    const _notes = host.notes;
    const _open_note = host.open_note;
    host.ensure_open_note();
  });
</script>

{#if !host.vault}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel />
  </div>
{:else}
  <main>
    <AppSidebar onOpenNote={(note_path) => void host.on_open_note(note_path)} />
  </main>
{/if}


