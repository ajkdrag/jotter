<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte"
  import type { Vault } from "$lib/types/vault"
  import type { VaultId } from "$lib/types/ids"

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    recent_vaults: Vault[]
    current_vault_id: VaultId | null
    is_loading?: boolean
    error?: string | null
    onChooseVaultDir: () => void
    onSelectVault: (vault_id: VaultId) => void
    hide_choose_vault_button?: boolean
  }

  let {
    open,
    onOpenChange,
    recent_vaults,
    current_vault_id,
    is_loading = false,
    error = null,
    onChooseVaultDir,
    onSelectVault,
    hide_choose_vault_button = false
  }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
  <Dialog.Content class="max-w-[65ch]" showCloseButton={false}>
    <VaultSelectionPanel
      isDialog={true}
      recent_vaults={recent_vaults}
      current_vault_id={current_vault_id}
      is_loading={is_loading}
      error={error}
      onChooseVaultDir={onChooseVaultDir}
      onSelectVault={onSelectVault}
      onClose={() => onOpenChange(false)}
      hide_choose_vault_button={hide_choose_vault_button}
    />
  </Dialog.Content>
</Dialog.Root>
