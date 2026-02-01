<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import { Info, GitBranch } from "@lucide/svelte"
  import type { CursorInfo } from "$lib/ports/editor_port"

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

<div class="EditorStatusBar border-t bg-muted/30 text-muted-foreground">
  <div class="EditorStatusBar__section">
    <span class="EditorStatusBar__item">
      Ln {line ?? '--'}, Col {column ?? '--'}
    </span>
    <span class="EditorStatusBar__separator">|</span>
    <span class="EditorStatusBar__item">
      {has_note ? word_count : '--'} words
    </span>
    <span class="EditorStatusBar__separator">|</span>
    <span class="EditorStatusBar__item">
      {total_lines ?? '--'} lines
    </span>
  </div>
  <div class="EditorStatusBar__section">
    <span class="EditorStatusBar__item EditorStatusBar__item--disabled">
      <GitBranch class="h-3 w-3" />
      <span>--</span>
    </span>
    <Button
      variant="ghost"
      size="icon"
      class="EditorStatusBar__info-btn"
      onclick={on_info_click}
      disabled={!has_note}
      aria-label="Note details"
    >
      <Info class="h-3.5 w-3.5" />
    </Button>
  </div>
</div>

<style>
  .EditorStatusBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 1.375rem;
    padding: 0 0.75rem;
    font-size: 0.6875rem;
    flex-shrink: 0;
  }

  .EditorStatusBar__section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .EditorStatusBar__item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .EditorStatusBar__item--disabled {
    opacity: 0.5;
  }

  .EditorStatusBar__separator {
    opacity: 0.25;
  }

  :global(.EditorStatusBar__info-btn) {
    height: 1.125rem;
    width: 1.125rem;
    opacity: 0.7;
  }

  :global(.EditorStatusBar__info-btn:hover:not(:disabled)) {
    opacity: 1;
  }
</style>
