<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import VaultSelectionPanel from '$lib/components/vault_selection_panel.svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import type { Ports } from '$lib/adapters/create_prod_ports'
  import type { VaultId } from '$lib/types/ids'
  import { use_xstate_machine } from '$lib/hooks/use_xstate_machine.svelte'
  import { change_vault_flow_machine } from '$lib/flows/change_vault_flow'

  type Props = { ports: Ports }
  let { ports }: Props = $props()

  const stable_ports = untrack(() => ports)

  const change_vault = use_xstate_machine(change_vault_flow_machine, {
    input: {
      ports: {
        vault: stable_ports.vault,
        notes: stable_ports.notes,
        index: stable_ports.index,
        navigation: stable_ports.navigation
      },
      app_state
    }
  })

  onMount(() => {
    change_vault.actor.send({ type: 'LOAD_RECENT' })
  })

  const is_loading = $derived(
    change_vault.snapshot.matches('loading_recent') || change_vault.snapshot.matches('changing')
  )

  function choose_vault_dir() {
    change_vault.actor.send({ type: 'CHOOSE_VAULT' })
  }

  function select_vault(vault_id: VaultId) {
    change_vault.actor.send({ type: 'SELECT_VAULT', vault_id })
  }
</script>

<div class="mx-auto max-w-[65ch] p-8">
  <VaultSelectionPanel
    recent_vaults={app_state.recent_vaults}
    current_vault_id={app_state.vault?.id ?? null}
    is_loading={is_loading}
    error={change_vault.snapshot.context.error}
    onChooseVaultDir={choose_vault_dir}
    onSelectVault={select_vault}
  />
</div>
