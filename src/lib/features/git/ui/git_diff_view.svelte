<script lang="ts">
  import type { GitDiff } from "$lib/shared/types/git";

  interface Props {
    diff: GitDiff | null;
  }

  let { diff }: Props = $props();
</script>

{#if diff && diff.hunks.length > 0}
  <div class="DiffView">
    {#each diff.hunks as hunk}
      <div class="DiffView__hunk">
        <div class="DiffView__header">{hunk.header}</div>
        {#each hunk.lines as line}
          <div
            class="DiffView__line"
            class:DiffView__line--addition={line.type === "addition"}
            class:DiffView__line--deletion={line.type === "deletion"}
          >
            <span class="DiffView__gutter DiffView__gutter--old">
              {line.old_line ?? ""}
            </span>
            <span class="DiffView__gutter DiffView__gutter--new">
              {line.new_line ?? ""}
            </span>
            <span class="DiffView__content">{line.content}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <div class="DiffView DiffView--empty">
    <span class="DiffView__placeholder">No changes to display</span>
  </div>
{/if}

<style>
  .DiffView {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    line-height: 1.5;
    overflow: auto;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .DiffView--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
  }

  .DiffView__placeholder {
    color: var(--muted-foreground);
    font-family: var(--font-sans, sans-serif);
    font-size: var(--text-sm);
  }

  .DiffView__hunk {
    border-bottom: 1px solid var(--border);
  }

  .DiffView__hunk:last-child {
    border-bottom: none;
  }

  .DiffView__header {
    padding: var(--space-1) var(--space-3);
    background-color: var(--muted);
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    user-select: none;
  }

  .DiffView__line {
    display: flex;
    min-height: 1.5em;
  }

  .DiffView__line--addition {
    background-color: color-mix(in oklch, var(--chart-2) 15%, transparent);
  }

  .DiffView__line--deletion {
    background-color: color-mix(in oklch, var(--destructive) 15%, transparent);
  }

  .DiffView__gutter {
    display: inline-flex;
    justify-content: flex-end;
    width: 3em;
    padding-inline: var(--space-1);
    color: var(--muted-foreground);
    user-select: none;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .DiffView__gutter--old {
    border-inline-end: 1px solid var(--border);
  }

  .DiffView__gutter--new {
    border-inline-end: 1px solid var(--border);
  }

  .DiffView__content {
    padding-inline: var(--space-2);
    white-space: pre;
  }
</style>
