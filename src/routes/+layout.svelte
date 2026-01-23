<script lang="ts">
  import "../app.css";
  import VaultDialog from "$lib/components/vault_dialog.svelte";
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { create_home_controller } from "$lib/controllers/home_controller";

  let { children } = $props();

  const ports = create_prod_ports();
  const controller = create_home_controller({ ports, state: app_state });
</script>

<main>
  {@render children()}
</main>

<VaultDialog
  open={controller.is_change_vault_dialog_open}
  onOpenChange={controller.toggle_change_vault_dialog_state}
  recent_vaults={controller.recent_vaults}
  current_vault_id={controller.vault?.id ?? null}
  onChooseVaultDir={controller.on_choose_vault}
  onSelectVault={controller.on_select_vault}
  onLoadRecent={controller.on_load_recent}
/>
