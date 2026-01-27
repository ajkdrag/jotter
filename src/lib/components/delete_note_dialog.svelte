<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import { Button } from "$lib/components/ui/button"
  import type { NoteMeta } from "$lib/types/note"

  interface Props {
    open: boolean
    note: NoteMeta | null
    is_deleting: boolean
    error: string | null
    on_confirm: () => void
    on_cancel: () => void
    on_retry: () => void
  }

  let { open, note, is_deleting, error, on_confirm, on_cancel, on_retry }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={(value: boolean) => { if (!value) on_cancel() }}>
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
      <Button variant="outline" onclick={on_cancel} disabled={is_deleting}>
        Cancel
      </Button>
      {#if error}
        <Button variant="destructive" onclick={on_retry}>
          Retry
        </Button>
      {:else}
        <Button variant="destructive" onclick={on_confirm} disabled={is_deleting}>
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
