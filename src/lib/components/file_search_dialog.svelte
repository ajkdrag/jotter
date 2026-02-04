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

  type DisplayItem = { note: NoteMeta; snippet?: string | undefined }

  const display_items: DisplayItem[] = $derived(
    query.trim()
      ? results.map((r) => ({ note: r.note, snippet: r.snippet }))
      : recent_notes.map((note) => ({ note }))
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
          on_confirm(display_items[selected_index].note.id)
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
  <Dialog.Content class="FileSearchDialog" showCloseButton={false}>
    <div class="FileSearchDialog__search">
      <SearchIcon />
      <Input
        bind:ref={input_ref}
        type="text"
        placeholder="Search notes..."
        value={query}
        oninput={(e: Event & { currentTarget: HTMLInputElement }) => { on_query_change(e.currentTarget.value); }}
        class="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {#if is_searching}
        <div class="FileSearchDialog__spinner"></div>
      {/if}
    </div>

    <div
      role="listbox"
      tabindex="0"
      aria-activedescendant={display_items[selected_index]
        ? `note-${display_items[selected_index].note.id}`
        : undefined}
      class="FileSearchDialog__list"
    >
      {#if show_recent_header}
        <div class="FileSearchDialog__header">
          <ClockIcon />
          <span>Recent</span>
        </div>
      {/if}

      {#if show_results_header}
        <div class="FileSearchDialog__results-count">
          {results.length} result{results.length === 1 ? '' : 's'}
        </div>
      {/if}

      {#if show_empty}
        <div class="FileSearchDialog__empty">
          {query.trim() ? 'No notes found' : 'No recent notes'}
        </div>
      {/if}

      {#each display_items as item, index (item.note.id)}
        <button
          id={`note-${item.note.id}`}
          role="option"
          aria-selected={index === selected_index}
          class="FileSearchDialog__item"
          class:FileSearchDialog__item--selected={index === selected_index}
          onmouseenter={() => { on_selected_index_change(index); }}
          onclick={() => { on_confirm(item.note.id); }}
        >
          <div class="FileSearchDialog__item-row">
            <FileIcon />
            <div class="FileSearchDialog__item-content">
              <span class="FileSearchDialog__item-title">{item.note.title}</span>
              <span class="FileSearchDialog__item-path">{item.note.path}</span>
              {#if item.snippet}
                <span class="FileSearchDialog__item-snippet">{item.snippet}</span>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>

<svelte:window onkeydown={handle_keydown} />

<style>
  :global(.FileSearchDialog) {
    max-width: var(--size-dialog-lg);
    padding: 0 !important;
    overflow: hidden;
  }

  .FileSearchDialog__search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  :global(.FileSearchDialog__search svg) {
    width: var(--size-icon);
    height: var(--size-icon);
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  .FileSearchDialog__spinner {
    width: var(--size-icon);
    height: var(--size-icon);
    border: 2px solid var(--muted-foreground);
    border-top-color: transparent;
    border-radius: 50%;
    flex-shrink: 0;
    animation: spin 1s linear infinite;
  }

  .FileSearchDialog__list {
    max-height: var(--size-dialog-list-height);
    overflow-y: auto;
    padding-block: var(--space-2);
  }

  .FileSearchDialog__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  :global(.FileSearchDialog__header svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  .FileSearchDialog__results-count {
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .FileSearchDialog__empty {
    padding: var(--space-8) var(--space-3);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .FileSearchDialog__item {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-radius: 0;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .FileSearchDialog__item:focus {
    outline: none;
  }

  .FileSearchDialog__item--selected {
    background-color: var(--interactive-bg);
  }

  .FileSearchDialog__item--selected .FileSearchDialog__item-title {
    color: var(--interactive);
  }

  .FileSearchDialog__item-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  :global(.FileSearchDialog__item-row svg) {
    width: var(--size-icon);
    height: var(--size-icon);
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  .FileSearchDialog__item--selected :global(.FileSearchDialog__item-row svg) {
    color: var(--interactive);
  }

  .FileSearchDialog__item-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .FileSearchDialog__item-title {
    font-weight: 500;
    color: var(--foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .FileSearchDialog__item-path,
  .FileSearchDialog__item-snippet {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
