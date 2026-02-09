<script lang="ts">
  import type { InFileMatch } from "$lib/types/search";
  import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import XIcon from "@lucide/svelte/icons/x";

  type Props = {
    open: boolean;
    query: string;
    matches: InFileMatch[];
    selected_match_index: number;
    on_query_change: (query: string) => void;
    on_next: () => void;
    on_prev: () => void;
    on_close: () => void;
  };

  let {
    open,
    query,
    matches,
    selected_match_index,
    on_query_change,
    on_next,
    on_prev,
    on_close,
  }: Props = $props();
  let input_ref: HTMLInputElement | null = $state(null);

  const count_display = $derived(
    matches.length > 0
      ? `${String(selected_match_index + 1)} of ${String(matches.length)}`
      : query.trim()
        ? "No results"
        : "",
  );

  $effect(() => {
    if (!open) return;
    const ref = input_ref;
    if (!ref) return;
    setTimeout(() => {
      ref.focus();
    }, 0);
  });

  function handle_keydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      on_close();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) on_prev();
      else on_next();
    }
  }
</script>

{#if open}
  <div class="FindInFileBar">
    <input
      bind:this={input_ref}
      class="FindInFileBar__input"
      type="text"
      placeholder="Find in file..."
      value={query}
      oninput={(e) => {
        on_query_change(e.currentTarget.value);
      }}
      onkeydown={handle_keydown}
    />
    {#if count_display}
      <span class="FindInFileBar__count">{count_display}</span>
    {/if}
    <button
      class="FindInFileBar__nav"
      onclick={on_prev}
      disabled={matches.length === 0}
    >
      <ChevronUpIcon />
    </button>
    <button
      class="FindInFileBar__nav"
      onclick={on_next}
      disabled={matches.length === 0}
    >
      <ChevronDownIcon />
    </button>
    <button class="FindInFileBar__close" onclick={on_close}>
      <XIcon />
    </button>
  </div>
{/if}

<style>
  .FindInFileBar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1-5) var(--space-3);
    border-bottom: 1px solid var(--border);
    background-color: var(--background);
  }

  .FindInFileBar__input {
    flex: 1;
    min-width: 0;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground);
  }

  .FindInFileBar__input:focus {
    outline: none;
    border-color: var(--ring);
  }

  .FindInFileBar__count {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .FindInFileBar__nav,
  .FindInFileBar__close {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-default);
  }

  .FindInFileBar__nav:hover,
  .FindInFileBar__close:hover {
    color: var(--foreground);
  }

  .FindInFileBar__nav:disabled {
    opacity: 0.3;
    cursor: default;
  }

  :global(.FindInFileBar__nav svg),
  :global(.FindInFileBar__close svg) {
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
  }
</style>
