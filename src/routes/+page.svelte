<script lang="ts">
  import { onMount } from "svelte";
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import AppSidebar from "$lib/components/app_sidebar.svelte";
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { reset_app_state_for_backend_switch } from "$lib/hosts/reset_app_state_for_backend_switch";
  import { create_home_host } from "$lib/hosts/home_host";

  let host: ReturnType<typeof create_home_host> | undefined = $state();

  onMount(() => {
    reset_app_state_for_backend_switch(app_state);
    const ports = create_prod_ports();
    host = create_home_host({ ports, state: app_state });
  });

  $effect(() => {
    if (host) {
      const _vault = host.vault;
      const _notes = host.notes;
      const _open_note = host.open_note;
      host.ensure_open_note();
    }
  });
</script>

{#if host}
  {@const h = host}
  {#if !h.vault}
    <div class="mx-auto max-w-[65ch] p-8">
      <VaultSelectionPanel
        recent_vaults={h.recent_vaults}
        current_vault_id={null}
        onChooseVaultDir={h.on_choose_vault}
        onSelectVault={h.on_select_vault}
        onLoadRecent={h.on_load_recent}
      />
    </div>
  {:else}
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
  {/if}
{/if}


