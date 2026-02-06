<script lang="ts">
  import { Info, GitBranch } from "@lucide/svelte"
  import type { CursorInfo } from "$lib/types/editor"

  interface Props {
    cursor_info: CursorInfo | null
    word_count: number
    has_note: boolean
    on_info_click: () => void
  }

  let { cursor_info, word_count, has_note, on_info_click }: Props = $props()

  const line = $derived(cursor_info?.line ?? null)
  const column = $derived(cursor_info?.column ?? null)
  const total_lines = $derived(cursor_info?.total_lines ?? null)
</script>

<div class="StatusBar">
  <div class="StatusBar__section">
    <span class="StatusBar__item">
      Ln {line ?? '--'}, Col {column ?? '--'}
    </span>
    <span class="StatusBar__separator" aria-hidden="true"></span>
    <span class="StatusBar__item">
      {has_note ? word_count : '--'} words
    </span>
    <span class="StatusBar__separator" aria-hidden="true"></span>
    <span class="StatusBar__item">
      {total_lines ?? '--'} lines
    </span>
  </div>
  <div class="StatusBar__section">
    <span class="StatusBar__item StatusBar__item--muted">
      <GitBranch />
      <span>--</span>
    </span>
    <button
      type="button"
      class="StatusBar__action"
      onclick={on_info_click}
      disabled={!has_note}
      aria-label="Note details"
    >
      <Info />
    </button>
  </div>
</div>

<style>
  .StatusBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--size-status-bar);
    padding-inline: var(--space-3);
    font-size: var(--text-xs);
    font-feature-settings: 'tnum' 1;
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    background-color: color-mix(in oklch, var(--muted) 30%, transparent);
    color: var(--muted-foreground);
  }

  .StatusBar__section {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .StatusBar__item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .StatusBar__item--muted {
    opacity: 0.5;
  }

  .StatusBar__separator {
    width: 1px;
    height: 0.625rem;
    background-color: currentColor;
    opacity: 0.2;
  }

  .StatusBar__action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-touch-xs);
    height: var(--size-touch-xs);
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    opacity: 0.7;
    transition: opacity var(--duration-fast) var(--ease-default);
  }

  .StatusBar__action:hover:not(:disabled) {
    opacity: 1;
    color: var(--interactive);
  }

  .StatusBar__action:focus-visible {
    opacity: 1;
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .StatusBar__action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(.StatusBar__item svg),
  :global(.StatusBar__action svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }
</style>
