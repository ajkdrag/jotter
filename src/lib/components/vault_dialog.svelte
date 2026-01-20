<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte"
  import { app_state } from "$lib/adapters/state/app_state.svelte"
</script>

<Dialog.Root bind:open={app_state.vault_dialog_open}>
  <Dialog.Content class="max-w-[65ch]" showCloseButton={false}>
    {#snippet children()}
      <VaultSelectionPanel
        isDialog={true}
        onClose={() => (app_state.vault_dialog_open = false)}
      />
    {/snippet}
  </Dialog.Content>
</Dialog.Root>
