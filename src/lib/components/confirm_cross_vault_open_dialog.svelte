<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";

  interface Props {
    open: boolean;
    is_switching: boolean;
    target_vault_name: string;
    on_confirm: () => void;
    on_cancel: () => void;
  }

  let { open, is_switching, target_vault_name, on_confirm, on_cancel }: Props =
    $props();
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value && !is_switching) on_cancel();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Switch Vault</Dialog.Title>
      <Dialog.Description>
        Switch to <span class="font-medium">{target_vault_name}</span> to open this
        note?
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_switching}>
        Cancel
      </Button>
      <Button onclick={on_confirm} disabled={is_switching}>
        {#if is_switching}
          Switching...
        {:else}
          Switch Vault
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
