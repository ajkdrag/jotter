<script lang="ts">
  import "../app.css";
  import VaultDialog from "$lib/components/vault_dialog.svelte";
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { create_home_host } from "$lib/hosts/home_host";

  let { children } = $props();

  const ports = create_prod_ports();
  const host = create_home_host({ ports, state: app_state });
</script>

<main>
  {@render children()}
</main>

<VaultDialog
  open={host.vault_dialog_open}
  onOpenChange={(open) => {
    app_state.vault_dialog_open = open;
  }}
  recent_vaults={host.recent_vaults}
  current_vault_id={host.vault?.id ?? null}
  onChooseVaultDir={host.on_choose_vault}
  onSelectVault={host.on_select_vault}
  onLoadRecent={host.on_load_recent}
/>
