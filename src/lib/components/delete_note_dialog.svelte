<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import { Button } from "$lib/components/ui/button"
  import type { NoteMeta } from "$lib/types/note"

  interface Props {
    open: boolean
    note: NoteMeta | null
    is_deleting: boolean
    error: string | null
    onConfirm: () => void
    onCancel: () => void
    onRetry: () => void
  }

  let { open, note, is_deleting, error, onConfirm, onCancel, onRetry }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={(value) => { if (!value) onCancel() }}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{error ? 'Delete Failed' : 'Delete Note'}</Dialog.Title>
      <Dialog.Description>
        {#if error}
          Failed to delete <span class="font-medium">{note?.title ?? 'this note'}</span>: {error}
        {:else}
          Are you sure you want to delete <span class="font-medium">{note?.title ?? 'this note'}</span>? This action cannot be undone.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel} disabled={is_deleting}>
        Cancel
      </Button>
      {#if error}
        <Button variant="destructive" onclick={onRetry}>
          Retry
        </Button>
      {:else}
        <Button variant="destructive" onclick={onConfirm} disabled={is_deleting}>
          {#if is_deleting}
            Deleting...
          {:else}
            Delete
          {/if}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
