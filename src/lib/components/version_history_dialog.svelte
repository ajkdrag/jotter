<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";
  import { History, RotateCcw } from "@lucide/svelte";
  import GitDiffView from "$lib/components/git_diff_view.svelte";
  import { format_relative_time } from "$lib/utils/relative_time";
  import type { GitCommit, GitDiff } from "$lib/types/git";

  interface Props {
    open: boolean;
    note_path: string | null;
    commits: GitCommit[];
    is_loading: boolean;
    is_restoring: boolean;
    selected_commit: GitCommit | null;
    diff: GitDiff | null;
    file_content: string | null;
    on_close: () => void;
    on_select_commit: (commit: GitCommit) => void;
    on_restore: (commit: GitCommit) => void;
  }

  let {
    open,
    note_path,
    commits,
    is_loading,
    is_restoring,
    selected_commit,
    diff,
    file_content,
    on_close,
    on_select_commit,
    on_restore,
  }: Props = $props();
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value) on_close();
  }}
>
  <Dialog.Content class="VersionHistory__dialog">
    <Dialog.Header>
      <Dialog.Title class="VersionHistory__title">
        <History class="VersionHistory__title-icon" />
        Version History
      </Dialog.Title>
      {#if note_path}
        <Dialog.Description class="VersionHistory__description">
          {note_path}
        </Dialog.Description>
      {/if}
    </Dialog.Header>

    <div class="VersionHistory__body">
      <div class="VersionHistory__timeline">
        {#if is_loading}
          <div class="VersionHistory__loading">Loading history...</div>
        {:else if commits.length === 0}
          <div class="VersionHistory__empty">No commits found</div>
        {:else}
          {#each commits as commit (commit.hash)}
            <button
              type="button"
              class="VersionHistory__commit"
              class:VersionHistory__commit--selected={selected_commit?.hash ===
                commit.hash}
              onclick={() => {
                on_select_commit(commit);
              }}
            >
              <span class="VersionHistory__commit-time">
                {format_relative_time(commit.timestamp_ms, Date.now())}
              </span>
              <span class="VersionHistory__commit-message">
                {commit.message}
              </span>
              <span class="VersionHistory__commit-author">{commit.author}</span>
              <span class="VersionHistory__commit-hash">
                {commit.short_hash}
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="VersionHistory__detail">
        {#if selected_commit && diff}
          <div class="VersionHistory__diff-header">
            <span class="VersionHistory__diff-stats">
              <span class="VersionHistory__diff-additions">
                +{diff.additions}
              </span>
              <span class="VersionHistory__diff-deletions">
                -{diff.deletions}
              </span>
            </span>
          </div>
          <div class="VersionHistory__diff-content">
            <GitDiffView {diff} />
          </div>
        {:else if selected_commit && file_content !== null}
          <div class="VersionHistory__preview">
            <pre class="VersionHistory__preview-content">{file_content}</pre>
          </div>
        {:else}
          <div class="VersionHistory__placeholder">
            Select a commit to view changes
          </div>
        {/if}
      </div>
    </div>

    {#if selected_commit}
      <Dialog.Footer>
        <Button variant="outline" onclick={on_close}>Close</Button>
        <Button
          variant="destructive"
          disabled={is_restoring}
          onclick={() => {
            if (selected_commit) on_restore(selected_commit);
          }}
        >
          <RotateCcw />
          {is_restoring ? "Restoring..." : "Restore This Version"}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.VersionHistory__dialog) {
    max-width: 56rem;
    width: 90vw;
    max-height: 80vh;
  }

  :global(.VersionHistory__title) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  :global(.VersionHistory__title-icon) {
    width: var(--size-icon);
    height: var(--size-icon);
  }

  :global(.VersionHistory__description) {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    opacity: 0.7;
  }

  .VersionHistory__body {
    display: grid;
    grid-template-columns: 14rem 1fr;
    gap: var(--space-3);
    min-height: 20rem;
    max-height: 50vh;
  }

  .VersionHistory__timeline {
    overflow-y: auto;
    border-right: 1px solid var(--border);
    padding-right: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .VersionHistory__loading,
  .VersionHistory__empty,
  .VersionHistory__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }

  .VersionHistory__commit {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    text-align: left;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .VersionHistory__commit:hover {
    background-color: var(--muted);
  }

  .VersionHistory__commit:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .VersionHistory__commit--selected {
    background-color: var(--interactive-bg);
  }

  .VersionHistory__commit--selected:hover {
    background-color: var(--interactive-bg-hover);
  }

  .VersionHistory__commit-time {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .VersionHistory__commit-message {
    font-size: var(--text-sm);
    color: var(--foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .VersionHistory__commit--selected .VersionHistory__commit-message {
    color: var(--interactive);
  }

  .VersionHistory__commit-author {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    opacity: 0.8;
  }

  .VersionHistory__commit-hash {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  .VersionHistory__detail {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .VersionHistory__diff-header {
    display: flex;
    align-items: center;
    padding-bottom: var(--space-2);
  }

  .VersionHistory__diff-stats {
    display: flex;
    gap: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
  }

  .VersionHistory__diff-additions {
    color: var(--chart-2);
  }

  .VersionHistory__diff-deletions {
    color: var(--destructive);
  }

  .VersionHistory__diff-content {
    flex: 1;
    overflow: auto;
  }

  .VersionHistory__preview {
    flex: 1;
    overflow: auto;
  }

  .VersionHistory__preview-content {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    line-height: 1.5;
    padding: var(--space-3);
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
