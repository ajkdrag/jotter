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
    onChooseVaultDir: () => Promise<void>
    onSelectVault: (vault_id: VaultId) => Promise<void>
    onLoadRecent: () => Promise<void>
  }

  let {
    open,
    onOpenChange,
    recent_vaults,
    current_vault_id,
    onChooseVaultDir,
    onSelectVault,
    onLoadRecent
  }: Props = $props()
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-[65ch]" showCloseButton={false}>
    {#snippet children()}
      <VaultSelectionPanel
        isDialog={true}
        recent_vaults={recent_vaults}
        current_vault_id={current_vault_id}
        onChooseVaultDir={onChooseVaultDir}
        onSelectVault={onSelectVault}
        onLoadRecent={onLoadRecent}
        onClose={() => onOpenChange(false)}
      />
    {/snippet}
  </Dialog.Content>
</Dialog.Root>
