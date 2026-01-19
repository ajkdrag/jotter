<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { DialogRoot, DialogPortal, DialogOverlay, DialogContent } from '$lib/components/ui/dialog'
  import Input from '$lib/components/ui/input.svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { note_route } from '$lib/utils/route_utils'

  type Props = {
    open: boolean
    placeholder: string
    onclose?: (e: CustomEvent<void>) => void
    onquery?: (e: CustomEvent<{ query: string }>) => void
  }

  let { open, placeholder }: Props = $props()

  const dispatch = createEventDispatcher<{
    close: void
    query: { query: string }
  }>()

  let q = $state('')

  $effect(() => {
    if (!open) q = ''
  })
</script>

<DialogRoot open={open} onOpenChange={(next_open: boolean) => (!next_open ? dispatch('close') : null)}>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 bg-black/55 backdrop-blur-sm" />
    <DialogContent
      class="fixed left-1/2 top-[14%] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-border bg-panel p-3 shadow-2xl"
    >
      <div class="flex items-center gap-2">
        <Input
          bind:value={q}
          placeholder={placeholder}
          oninput={() => dispatch('query', { query: q })}
          class_name="bg-bg"
          autofocus
        />
      </div>

      <div class="mt-3 max-h-[50vh] overflow-auto rounded-xl border border-border bg-bg">
        {#if app_state.search_results.length === 0 && q.trim().length > 0}
          <div class="px-3 py-3 text-sm text-muted">No results.</div>
        {:else}
          {#each app_state.search_results as hit (hit.note.id)}
            <a
              class="block border-b border-border px-3 py-2 hover:bg-panel2"
              href={note_route(hit.note.path)}
              onclick={() => dispatch('close')}
            >
              <div class="text-sm font-semibold">{hit.note.title}</div>
              <div class="text-xs text-muted">{hit.note.path}</div>
              {#if hit.snippet}
                <div class="mt-1 line-clamp-2 text-xs text-muted">{hit.snippet}</div>
              {/if}
            </a>
          {/each}
        {/if}
      </div>
    </DialogContent>
  </DialogPortal>
</DialogRoot>
