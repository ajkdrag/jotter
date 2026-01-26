<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import { Button } from "$lib/components/ui/button"

  interface Props {
    open: boolean
    is_saving: boolean
    error: string | null
    onRetry: () => void
    onCancel: () => void
  }

  let { open, is_saving, error, onRetry, onCancel }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={(value) => { if (!value && !is_saving) onCancel() }}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Save Failed</Dialog.Title>
      <Dialog.Description>
        {#if error}
          Failed to save note: {error}
        {:else}
          An error occurred while saving the note.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel} disabled={is_saving}>
        Cancel
      </Button>
      <Button onclick={onRetry} disabled={is_saving}>
        {#if is_saving}
          Saving...
        {:else}
          Retry
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
