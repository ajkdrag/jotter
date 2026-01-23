<script lang="ts">
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { create_prod_ports } from '$lib/adapters/create_prod_ports'
  import { create_home_controller } from '$lib/controllers/home_controller'

  const ports = create_prod_ports()
  const controller = create_home_controller({ ports, state: app_state })
</script>

<VaultSelectionPanel
  recent_vaults={controller.recent_vaults}
  current_vault_id={controller.vault?.id ?? null}
  onChooseVaultDir={controller.on_choose_vault}
  onSelectVault={controller.on_select_vault}
  onLoadRecent={controller.on_load_recent}
/>
