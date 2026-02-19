<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";
  import type { OpenNoteState } from "$lib/types/editor";
  import { format_bytes } from "$lib/utils/format_bytes";

  interface Props {
    open: boolean;
    note: OpenNoteState | null;
    word_count: number;
    line_count: number;
    on_close: () => void;
  }

  let { open, note, word_count, line_count, on_close }: Props = $props();

  function format_date(ms: number): string {
    return new Date(ms).toLocaleString();
  }
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value) on_close();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Note Details</Dialog.Title>
      <Dialog.Description>
        Information about the current note
      </Dialog.Description>
    </Dialog.Header>
    {#if note}
      <div class="NoteDetailsDialog__grid">
        <div class="NoteDetailsDialog__row">
          <span class="NoteDetailsDialog__label">Title</span>
          <span class="NoteDetailsDialog__value">{note.meta.title}</span>
        </div>
        <div class="NoteDetailsDialog__row">
          <span class="NoteDetailsDialog__label">Path</span>
          <span class="NoteDetailsDialog__value NoteDetailsDialog__value--mono"
            >{note.meta.path}</span
          >
        </div>
        <div class="NoteDetailsDialog__row">
          <span class="NoteDetailsDialog__label">Size</span>
          <span class="NoteDetailsDialog__value"
            >{format_bytes(note.meta.size_bytes)}</span
          >
        </div>
        <div class="NoteDetailsDialog__row">
          <span class="NoteDetailsDialog__label">Modified</span>
          <span class="NoteDetailsDialog__value"
            >{format_date(note.meta.mtime_ms)}</span
          >
        </div>
        <div class="NoteDetailsDialog__row">
          <span class="NoteDetailsDialog__label">Words</span>
          <span class="NoteDetailsDialog__value">{word_count}</span>
        </div>
        <div class="NoteDetailsDialog__row">
          <span class="NoteDetailsDialog__label">Lines</span>
          <span class="NoteDetailsDialog__value">{line_count}</span>
        </div>
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={on_close}>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .NoteDetailsDialog__grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-2) 0;
  }

  .NoteDetailsDialog__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-4);
  }

  .NoteDetailsDialog__label {
    font-size: var(--text-base);
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .NoteDetailsDialog__value {
    font-size: var(--text-base);
    text-align: right;
    word-break: break-word;
  }

  .NoteDetailsDialog__value--mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
</style>
