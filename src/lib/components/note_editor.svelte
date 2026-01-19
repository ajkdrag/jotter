<script lang="ts">
  import { onDestroy, onMount, createEventDispatcher } from 'svelte'
  import type { OpenNoteState } from '$lib/types/editor'
  import { create_milkdown_editor } from '$lib/adapters/editor/milkdown_adapter'
  import type { MilkdownHandle } from '$lib/adapters/editor/milkdown_adapter'
  import Button from '$lib/components/ui/button.svelte'
  import Input from '$lib/components/ui/input.svelte'
  import { DialogRoot, DialogPortal, DialogOverlay, DialogContent } from '$lib/components/ui/dialog'
  import type { VaultId } from '$lib/types/ids'
  import { as_asset_path } from '$lib/types/ids'
  import { imdown_asset_url } from '$lib/utils/asset_url'

  type Props = {
    note: OpenNoteState
    vault_id: VaultId
    onchange?: (e: CustomEvent<{ markdown: string }>) => void
    onready?: (e: CustomEvent<MilkdownHandle>) => void
  }

  let { note, vault_id }: Props = $props()

  const dispatch = createEventDispatcher<{
    change: { markdown: string }
    ready: MilkdownHandle
  }>()

  let root: HTMLDivElement | null = $state(null)
  let handle: MilkdownHandle | null = null
  let link_open = $state(false)
  let link_href = $state('')

  onMount(async () => {
    if (!root) return
    handle = await create_milkdown_editor(root, {
      initial_markdown: note.markdown,
      on_markdown_change: (markdown) => dispatch('change', { markdown }),
      resolve_image_src: (src) => {
        const s = String(src)
        if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s
        return imdown_asset_url(vault_id, as_asset_path(s))
      }
    })
    dispatch('ready', handle)
  })

  onDestroy(() => {
    handle?.destroy()
  })
</script>

<div class="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg p-2">
  <Button
    variant="outline"
    onmousedown={(e: MouseEvent) => {
      e.preventDefault()
      handle?.toggle_bold()
    }}
    class_name="h-9 px-2 py-0"
  >
    Bold
  </Button>
  <Button
    variant="outline"
    onmousedown={(e: MouseEvent) => {
      e.preventDefault()
      handle?.toggle_italic()
    }}
    class_name="h-9 px-2 py-0"
  >
    Italic
  </Button>
  <Button
    variant="outline"
    onmousedown={(e: MouseEvent) => {
      e.preventDefault()
      link_href = ''
      link_open = true
    }}
    class_name="h-9 px-2 py-0"
  >
    Link
  </Button>
  <Button
    variant="outline"
    onmousedown={(e: MouseEvent) => {
      e.preventDefault()
      handle?.create_code_block()
    }}
    class_name="h-9 px-2 py-0"
  >
    Code block
  </Button>
</div>

<div class="min-h-[70vh]" bind:this={root}></div>

<DialogRoot bind:open={link_open}>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 bg-black/55 backdrop-blur-sm" />
    <DialogContent
      class="fixed left-1/2 top-[18%] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-border bg-panel p-4 shadow-2xl"
    >
      <div class="text-sm font-semibold">Insert link</div>
      <div class="mt-2">
        <Input bind:value={link_href} placeholder="https://…" />
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          onclick={() => {
            link_open = false
          }}
        >
          Cancel
        </Button>
        <Button
          onclick={() => {
            const href = link_href.trim()
            if (href) handle?.toggle_link(href)
            link_open = false
          }}
        >
          Apply
        </Button>
      </div>
    </DialogContent>
  </DialogPortal>
</DialogRoot>
