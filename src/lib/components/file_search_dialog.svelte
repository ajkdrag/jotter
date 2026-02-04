<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input'
  import SearchIcon from '@lucide/svelte/icons/search'
  import FileIcon from '@lucide/svelte/icons/file-text'
  import ClockIcon from '@lucide/svelte/icons/clock'
  import type { NoteSearchHit } from '$lib/types/search'
  import type { NoteId } from '$lib/types/ids'
  import type { NoteMeta } from '$lib/types/note'

  type Props = {
    open: boolean
    query: string
    results: NoteSearchHit[]
    recent_notes: NoteMeta[]
    selected_index: number
    is_searching: boolean
    on_open_change: (open: boolean) => void
    on_query_change: (query: string) => void
    on_selected_index_change: (index: number) => void
    on_confirm: (note_id: NoteId) => void
  }

  let {
    open,
    query,
    results,
    recent_notes,
    selected_index,
    is_searching,
    on_open_change,
    on_query_change,
    on_selected_index_change,
    on_confirm
  }: Props = $props()

  let input_ref: HTMLInputElement | null = $state(null)

  const display_items = $derived(
    query.trim() ? results.map((r) => r.note) : recent_notes
  )

  const show_recent_header = $derived(!query.trim() && recent_notes.length > 0)
  const show_results_header = $derived(query.trim() && results.length > 0)
  const show_empty = $derived(
    (query.trim() && !is_searching && results.length === 0) ||
      (!query.trim() && recent_notes.length === 0)
  )

  function handle_keydown(event: KeyboardEvent) {
    if (!open) return

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        on_open_change(false)
        break
      case 'ArrowDown':
        event.preventDefault()
        if (display_items.length > 0) {
          on_selected_index_change((selected_index + 1) % display_items.length)
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (display_items.length > 0) {
          on_selected_index_change(
            (selected_index - 1 + display_items.length) % display_items.length
          )
        }
        break
      case 'Enter':
        event.preventDefault()
        if (display_items[selected_index]) {
          on_confirm(display_items[selected_index].id)
        }
        break
    }
  }

  $effect(() => {
    if (!open) return
    const ref = input_ref
    if (!ref) return
    setTimeout(() => { ref.focus() }, 0)
  })
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="max-w-lg p-0" showCloseButton={false}>
    <div class="flex items-center border-b px-3">
      <SearchIcon class="size-4 text-muted-foreground shrink-0" />
      <Input
        bind:ref={input_ref}
        type="text"
        placeholder="Search notes..."
        value={query}
        oninput={(e: Event & { currentTarget: HTMLInputElement }) => { on_query_change(e.currentTarget.value); }}
        class="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {#if is_searching}
        <div class="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin shrink-0"></div>
      {/if}
    </div>

    <div
      role="listbox"
      tabindex="0"
      aria-activedescendant={display_items[selected_index]
        ? `note-${display_items[selected_index].id}`
        : undefined}
      class="max-h-80 overflow-y-auto py-2"
    >
      {#if show_recent_header}
        <div class="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <ClockIcon class="size-3" />
          <span>Recent</span>
        </div>
      {/if}

      {#if show_results_header}
        <div class="px-3 py-1.5 text-xs text-muted-foreground">
          {results.length} result{results.length === 1 ? '' : 's'}
        </div>
      {/if}

      {#if show_empty}
        <div class="px-3 py-8 text-center text-sm text-muted-foreground">
          {query.trim() ? 'No notes found' : 'No recent notes'}
        </div>
      {/if}

      {#each display_items as item, index (item.id)}
        <button
          id={`note-${item.id}`}
          role="option"
          aria-selected={index === selected_index}
          class="w-full px-3 py-2 text-left transition-colors focus:outline-none"
          class:bg-muted={index === selected_index}
          onmouseenter={() => { on_selected_index_change(index); }}
          onclick={() => { on_confirm(item.id); }}
        >
          <div class="flex items-center gap-2">
            <FileIcon class="size-4 text-muted-foreground shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="font-medium text-foreground truncate">{item.title}</span>
              <span class="text-xs text-muted-foreground truncate">{item.path}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>

<svelte:window onkeydown={handle_keydown} />
