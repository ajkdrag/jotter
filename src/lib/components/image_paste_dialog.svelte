<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import type { ImagePasteData } from "$lib/types/image_paste"
  import { format_bytes } from "$lib/utils/format_bytes"

  type Props = {
    open: boolean
    image_data: ImagePasteData | null
    custom_name: string
    is_saving: boolean
    error: string | null
    on_name_change: (name: string) => void
    on_confirm: () => void
    on_cancel: () => void
    on_retry: () => void
  }

  let { open, image_data, custom_name, is_saving, error, on_name_change, on_confirm, on_cancel, on_retry }: Props = $props()

  let preview_url = $state<string | null>(null)
  let name_input: HTMLInputElement | null = $state(null)

  $effect(() => {
    if (!image_data) {
      preview_url = null
      return
    }

    const buffer =
      image_data.original_bytes.buffer instanceof ArrayBuffer
        ? image_data.original_bytes.buffer.slice(
            image_data.original_bytes.byteOffset,
            image_data.original_bytes.byteOffset + image_data.original_bytes.byteLength
          )
        : Uint8Array.from(image_data.original_bytes).buffer
    const blob = new Blob([buffer], { type: image_data.mime_type })
    const url = URL.createObjectURL(blob)
    preview_url = url

    return () => {
      URL.revokeObjectURL(url)
    }
  })

  $effect(() => {
    if (open && name_input) {
      name_input.focus()
      name_input.select()
    }
  })
</script>

<Dialog.Root {open} onOpenChange={(value: boolean) => { if (!value) on_cancel() }}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>{error ? 'Paste Failed' : 'Paste Image'}</Dialog.Title>
      <Dialog.Description>
        {error ? 'Fix the name and retry the paste.' : 'Name the image before inserting it.'}
      </Dialog.Description>
    </Dialog.Header>

    {#if image_data}
      <div class="flex flex-col gap-4 py-2">
        <div class="flex items-center justify-center rounded-md border border-border bg-muted p-3">
          {#if preview_url}
            <img src={preview_url} alt={custom_name || 'Image preview'} class="max-h-48 w-auto rounded-sm object-contain" />
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">Image name</span>
          <Input
            bind:ref={name_input}
            value={custom_name}
            placeholder="image-name"
            oninput={(event: Event & { currentTarget: HTMLInputElement }) => on_name_change(event.currentTarget.value)}
          />
          <span class="text-xs text-muted-foreground">
            {image_data.width}×{image_data.height} · {format_bytes(image_data.original_bytes.byteLength)} · {image_data.original_name}
          </span>
        </div>
      </div>
    {/if}

    <Dialog.Footer>
      {#if error}
        <span class="text-destructive text-sm mr-auto">{error}</span>
      {/if}
      <Button variant="outline" onclick={on_cancel} disabled={is_saving}>
        Cancel
      </Button>
      {#if error}
        <Button onclick={on_retry} disabled={is_saving}>
          Retry
        </Button>
      {:else}
        <Button onclick={on_confirm} disabled={is_saving || custom_name.trim() === ''}>
          {is_saving ? 'Saving...' : 'Insert'}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
