<script lang="ts">
  import { onMount } from "svelte";
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import AppSidebar from "$lib/components/app_sidebar.svelte";
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { reset_app_state_for_backend_switch } from "$lib/utils/reset_app_state_for_backend_switch";
  import { create_home_controller } from "$lib/controllers/home_controller";

  let controller: ReturnType<typeof create_home_controller> | undefined = $state();

  onMount(() => {
    reset_app_state_for_backend_switch(app_state);
    const ports = create_prod_ports();
    controller = create_home_controller({ ports, state: app_state });
  });

  $effect(() => {
    if (controller) {
      const _vault = controller.vault;
      const _notes = controller.notes;
      const _open_note = controller.open_note;
      controller.ensure_open_note();
    }
  });
</script>

{#if controller}
  {@const c = controller}
  {#if !c.vault}
    <div class="mx-auto max-w-[65ch] p-8">
      <VaultSelectionPanel
        recent_vaults={c.recent_vaults}
        current_vault_id={null}
        onChooseVaultDir={c.on_choose_vault}
        onSelectVault={c.on_select_vault}
        onLoadRecent={c.on_load_recent}
      />
    </div>
  {:else}
    <main>
      <AppSidebar
        vault={c.vault}
        notes={c.notes}
        open_note_title={c.open_note?.meta.title ?? "Notes"}
        is_vault_dialog_open={c.is_change_vault_dialog_open}
        open_note={c.open_note}
        onOpenNote={(note_path) => void c.on_open_note(note_path)}
        onRequestChangeVault={c.on_request_change_vault}
        onMarkdownChange={c.on_markdown_change}
      />
    </main>
  {/if}
{/if}


