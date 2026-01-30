<script lang="ts">
  import { tick } from 'svelte'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button'

  type Props = {
    open: boolean
    parent_path: string
    folder_name: string
    is_creating: boolean
    error: string | null
    on_folder_name_change: (name: string) => void
    on_confirm: () => void
    on_cancel: () => void
  }

  let {
    open,
    parent_path,
    folder_name,
    is_creating,
    error,
    on_folder_name_change,
    on_confirm,
    on_cancel
  }: Props = $props()

  let input_el: HTMLInputElement | null = $state(null)

  $effect(() => {
    if (open && input_el) {
      tick().then(() => input_el?.focus())
    }
  })

  const parent_label = $derived(parent_path ? `./${parent_path}` : './')
  const is_valid =
    $derived(
      folder_name.trim().length > 0 &&
        !folder_name.includes('/') &&
        folder_name !== '.' &&
        folder_name !== '..'
    )
</script>

<Dialog.Root {open} onOpenChange={(value: boolean) => { if (!value) on_cancel() }}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>New folder</Dialog.Title>
      <Dialog.Description>
        Create in {parent_label}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <input
        bind:this={input_el}
        type="text"
        value={folder_name}
        oninput={(e) => on_folder_name_change(e.currentTarget.value)}
        placeholder="Folder name"
        disabled={is_creating}
        class="border-input bg-background ring-offset-background placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_creating}>
        Cancel
      </Button>
      <Button
        variant="default"
        onclick={on_confirm}
        disabled={!is_valid || is_creating}
      >
        {#if is_creating}
          Creating...
        {:else}
          Save
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
