<script lang="ts">
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { create_prod_ports } from '$lib/adapters/create_prod_ports'
  import { create_home_host } from '$lib/hosts/home_host'

  const ports = create_prod_ports()
  const host = create_home_host({ ports, state: app_state })
</script>

<VaultSelectionPanel
  recent_vaults={host.recent_vaults}
  current_vault_id={host.vault?.id ?? null}
  onChooseVaultDir={host.on_choose_vault}
  onSelectVault={host.on_select_vault}
  onLoadRecent={host.on_load_recent}
/>
