<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'

  type RenameFolderDialogState = 'idle' | 'confirming' | 'renaming' | 'error'

  type Props = {
    open: boolean
    new_path: string | null
    status: string
    error: string | null
    on_update_path: (path: string) => void
    on_confirm: () => void
    on_cancel: () => void
    on_retry: () => void
  }

  let {
    open,
    new_path,
    status,
    error,
    on_update_path,
    on_confirm,
    on_cancel,
    on_retry
  }: Props = $props()

  const normalized_state = $derived((status as RenameFolderDialogState) ?? 'idle')
  const is_confirming = $derived(normalized_state === 'confirming')
  const is_renaming = $derived(normalized_state === 'renaming')
  const is_error = $derived(normalized_state === 'error')

  let input_ref: HTMLInputElement | undefined = $state()
  let new_path_value = $state('')

  $effect(() => {
    if (is_confirming && new_path) {
      new_path_value = new_path
    }
  })

  function handle_input(event: Event) {
    const target = event.target as HTMLInputElement
    new_path_value = target.value
    on_update_path(target.value)
  }

  function handle_open_change(next_open: boolean) {
    if (!next_open && (is_confirming || is_error)) {
      on_cancel()
    }
  }

  function handle_open_auto_focus(event: Event) {
    event.preventDefault()
    const ref = input_ref
    if (!ref) return
    const parts = new_path_value.split('/')
    const folder_name = parts[parts.length - 1] || ''
    const parent_path = parts.slice(0, -1).join('/')
    const start_pos = parent_path ? parent_path.length + 1 : 0
    setTimeout(() => {
      ref.focus()
      ref.setSelectionRange(start_pos, start_pos + folder_name.length)
    }, 0)
  }
</script>

<Dialog.Root open={open} onOpenChange={handle_open_change}>
  <Dialog.Content class="max-w-md" onOpenAutoFocus={handle_open_auto_focus}>
    <Dialog.Header>
      <Dialog.Title>{is_error ? 'Rename Failed' : 'Rename Folder'}</Dialog.Title>
      <Dialog.Description>
        {#if is_error}
          {error || 'An unknown error occurred'}
        {:else}
          Enter a new path for the folder
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    {#if !is_error}
      <div class="grid gap-4 py-4">
        <input
          bind:this={input_ref}
          type="text"
          class="bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          value={new_path_value}
          oninput={handle_input}
          disabled={is_renaming}
          placeholder="folder/path"
        />
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_renaming}>
        Cancel
      </Button>
      {#if is_error}
        <Button onclick={on_retry}>
          Retry
        </Button>
      {:else}
        <Button onclick={on_confirm} disabled={is_renaming}>
          {is_renaming ? 'Renaming...' : 'Rename'}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
