<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { VaultId } from '$lib/types/ids'
  import { use_flow_handle } from '$lib/hooks/use_flow_handle.svelte'
  import { create_app_flows } from '$lib/flows/create_app_flows'

  type Props = { ports: Ports }
  let { ports }: Props = $props()

  const stable_ports = untrack(() => ports)
  const app = untrack(() => create_app_flows(stable_ports))

  const model = use_flow_handle(app.model)
  const change_vault = use_flow_handle(app.flows.change_vault)

  const is_loading = $derived(
    change_vault.snapshot.matches('loading_recent') || change_vault.snapshot.matches('changing')
  )

  const actions = {
    mount() {
      model.send({ type: 'RESET' })
      change_vault.send({ type: 'LOAD_RECENT' })
    },
    choose_vault_dir() {
      change_vault.send({ type: 'CHOOSE_VAULT' })
    },
    select_vault(vault_id: VaultId) {
      change_vault.send({ type: 'SELECT_VAULT', vault_id })
    }
  }

  onMount(() => {
    actions.mount()
  })
</script>

<div class="mx-auto max-w-[65ch] p-8">
  <VaultSelectionPanel
    recent_vaults={model.snapshot.context.recent_vaults}
    current_vault_id={model.snapshot.context.vault?.id ?? null}
    is_loading={is_loading}
    error={change_vault.snapshot.context.error}
    onChooseVaultDir={actions.choose_vault_dir}
    onSelectVault={actions.select_vault}
  />
</div>
