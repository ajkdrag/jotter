<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte"
  import type { Vault } from "$lib/types/vault"
  import type { VaultId } from "$lib/types/ids"

  interface Props {
    open: boolean
    on_open_change: (open: boolean) => void
    recent_vaults: Vault[]
    current_vault_id: VaultId | null
    is_loading?: boolean
    error?: string | null
    on_choose_vault_dir: () => void
    on_select_vault: (vault_id: VaultId) => void
    hide_choose_vault_button?: boolean
  }

  let {
    open,
    on_open_change,
    recent_vaults,
    current_vault_id,
    is_loading = false,
    error = null,
    on_choose_vault_dir,
    on_select_vault,
    hide_choose_vault_button = false
  }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="max-w-[65ch]" showCloseButton={false}>
    <VaultSelectionPanel
      is_dialog={true}
      recent_vaults={recent_vaults}
      current_vault_id={current_vault_id}
      is_loading={is_loading}
      error={error}
      on_choose_vault_dir={on_choose_vault_dir}
      on_select_vault={on_select_vault}
      on_close={() => { on_open_change(false); }}
      hide_choose_vault_button={hide_choose_vault_button}
    />
  </Dialog.Content>
</Dialog.Root>
