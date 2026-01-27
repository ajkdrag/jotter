<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import { Button } from "$lib/components/ui/button"
  import type { NoteMeta } from "$lib/types/note"
  import type { NotePath } from "$lib/types/ids"

  interface Props {
    open: boolean
    note: NoteMeta | null
    new_path: NotePath | null
    is_renaming: boolean
    is_checking_conflict: boolean
    error: string | null
    show_overwrite_confirm: boolean
    onUpdatePath: (path: NotePath) => void
    onConfirm: () => void
    onConfirmOverwrite: () => void
    onCancel: () => void
    onRetry: () => void
  }

  let {
    open,
    note,
    new_path,
    is_renaming,
    is_checking_conflict,
    error,
    show_overwrite_confirm,
    onUpdatePath,
    onConfirm,
    onConfirmOverwrite,
    onCancel,
    onRetry
  }: Props = $props()

  let input_value = $derived(new_path ?? '')

  function update_input(value: string) {
    onUpdatePath(value as NotePath)
  }

  function get_display_title() {
    if (error) return 'Rename Failed'
    if (show_overwrite_confirm) return 'File Already Exists'
    return 'Rename Note'
  }

  function get_display_description() {
    if (error) {
      return `Failed to rename ${note?.title ?? 'this note'}: ${error}`
    }
    if (show_overwrite_confirm) {
      return `A note already exists at ${new_path}. Do you want to overwrite it?`
    }
    return `Enter the new path for ${note?.title ?? 'this note'}.`
  }

  function is_input_valid(): boolean {
    return input_value.trim().length > 0 && input_value !== note?.path
  }
</script>

<Dialog.Root {open} onOpenChange={(value) => { if (!value) onCancel() }}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{get_display_title()}</Dialog.Title>
      <Dialog.Description>
        {get_display_description()}
      </Dialog.Description>
    </Dialog.Header>

    {#if !error && !show_overwrite_confirm}
      <div class="space-y-4">
        <input
          type="text"
          value={input_value}
          onchange={(e) => update_input(e.currentTarget.value)}
          oninput={(e) => update_input(e.currentTarget.value)}
          placeholder="e.g., folder/new-title.md"
          disabled={is_renaming || is_checking_conflict}
          class="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    {/if}

    <Dialog.Footer>
      {#if show_overwrite_confirm}
        <Button variant="outline" onclick={onCancel} disabled={is_renaming}>
          Cancel
        </Button>
        <Button variant="destructive" onclick={onConfirmOverwrite} disabled={is_renaming}>
          {#if is_renaming}
            Renaming...
          {:else}
            Overwrite
          {/if}
        </Button>
      {:else if error}
        <Button variant="outline" onclick={onCancel} disabled={is_renaming}>
          Cancel
        </Button>
        <Button variant="default" onclick={onRetry} disabled={is_renaming}>
          Retry
        </Button>
      {:else}
        <Button variant="outline" onclick={onCancel} disabled={is_renaming || is_checking_conflict}>
          Cancel
        </Button>
        <Button
          variant="default"
          onclick={onConfirm}
          disabled={!is_input_valid() || is_renaming || is_checking_conflict}
        >
          {#if is_renaming || is_checking_conflict}
            Renaming...
          {:else}
            Rename
          {/if}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
