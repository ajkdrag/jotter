<script lang="ts">
  import { Info, FolderOpen, RefreshCw } from "@lucide/svelte";
  import ThemeToggle from "$lib/components/theme_toggle.svelte";
  import GitStatusWidget from "$lib/components/git_status_widget.svelte";
  import type { CursorInfo } from "$lib/types/editor";
  import type { IndexProgress } from "$lib/stores/search_store.svelte";
  import type { ThemeMode } from "$lib/types/theme";
  import type { GitSyncStatus } from "$lib/types/git";

  interface Props {
    cursor_info: CursorInfo | null;
    word_count: number;
    has_note: boolean;
    index_progress: IndexProgress;
    vault_name: string | null;
    theme_mode: ThemeMode;
    git_enabled: boolean;
    git_branch: string;
    git_is_dirty: boolean;
    git_pending_files: number;
    git_sync_status: GitSyncStatus;
    on_vault_click: () => void;
    on_info_click: () => void;
    on_git_click: () => void;
    on_theme_change: (mode: ThemeMode) => void;
  }

  let {
    cursor_info,
    word_count,
    has_note,
    index_progress,
    vault_name,
    theme_mode,
    git_enabled,
    git_branch,
    git_is_dirty,
    git_pending_files,
    git_sync_status,
    on_vault_click,
    on_info_click,
    on_git_click,
    on_theme_change,
  }: Props = $props();

  const line = $derived(cursor_info?.line ?? null);
  const column = $derived(cursor_info?.column ?? null);
  const total_lines = $derived(cursor_info?.total_lines ?? null);
  const show_index_counts = $derived(
    index_progress.total > 1 || index_progress.indexed > 0,
  );

  let show_completed = $state(false);
  let completed_timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (index_progress.status === "completed") {
      show_completed = true;
      completed_timer = setTimeout(() => {
        show_completed = false;
      }, 3000);
    }
    return () => {
      if (completed_timer) {
        clearTimeout(completed_timer);
      }
    };
  });
</script>

<div class="StatusBar">
  <div class="StatusBar__section">
    <span class="StatusBar__item">
      Ln {line ?? "--"}, Col {column ?? "--"}
    </span>
    <span class="StatusBar__separator" aria-hidden="true"></span>
    <span class="StatusBar__item">
      {has_note ? word_count : "--"} words
    </span>
    <span class="StatusBar__separator" aria-hidden="true"></span>
    <span class="StatusBar__item">
      {total_lines ?? "--"} lines
    </span>
  </div>
  <div class="StatusBar__section">
    {#if index_progress.status === "indexing"}
      <span class="StatusBar__item StatusBar__item--indexing">
        <RefreshCw class="StatusBar__spinner" />
        {#if show_index_counts}
          <span>Indexing {index_progress.indexed}/{index_progress.total}</span>
        {:else}
          <span>Indexing...</span>
        {/if}
      </span>
      <span class="StatusBar__separator" aria-hidden="true"></span>
    {:else if index_progress.status === "failed"}
      <span class="StatusBar__item StatusBar__item--failed">
        <span>Index failed</span>
      </span>
      <span class="StatusBar__separator" aria-hidden="true"></span>
    {:else if show_completed}
      <span class="StatusBar__item StatusBar__item--completed">
        <span>Indexed</span>
      </span>
      <span class="StatusBar__separator" aria-hidden="true"></span>
    {/if}
    <button
      type="button"
      class="StatusBar__vault-action"
      onclick={on_vault_click}
      disabled={!vault_name}
      aria-label="Switch vault"
    >
      <FolderOpen />
      <span>{vault_name ?? "--"}</span>
    </button>
    <button
      type="button"
      class="StatusBar__action"
      onclick={on_info_click}
      disabled={!has_note}
      aria-label="Note details"
    >
      <Info />
    </button>
    {#if git_enabled}
      <span class="StatusBar__separator" aria-hidden="true"></span>
      <GitStatusWidget
        enabled={git_enabled}
        branch={git_branch}
        is_dirty={git_is_dirty}
        pending_files={git_pending_files}
        sync_status={git_sync_status}
        on_click={on_git_click}
      />
    {/if}
    <span class="StatusBar__separator" aria-hidden="true"></span>
    <ThemeToggle mode={theme_mode} on_change={on_theme_change} />
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
    font-feature-settings: "tnum" 1;
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

  .StatusBar__item--indexing {
    color: var(--primary);
  }

  .StatusBar__item--failed {
    color: var(--destructive);
  }

  .StatusBar__item--completed {
    color: var(--muted-foreground);
  }

  .StatusBar__separator {
    width: 1px;
    height: var(--space-2-5);
    background-color: currentColor;
    opacity: 0.2;
  }

  .StatusBar__vault-action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 14rem;
    border-radius: var(--radius-sm);
    opacity: 0.7;
    transition:
      opacity var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .StatusBar__vault-action > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .StatusBar__vault-action:hover:not(:disabled) {
    opacity: 1;
    color: var(--interactive);
  }

  .StatusBar__vault-action:focus-visible {
    opacity: 1;
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .StatusBar__vault-action:disabled {
    opacity: 0.4;
    cursor: default;
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
  :global(.StatusBar__action svg),
  :global(.StatusBar__vault-action svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  :global(.StatusBar .ThemeToggle) {
    padding: 1px;
  }

  :global(.StatusBar .ThemeToggle__option) {
    width: var(--size-touch-xs);
    height: var(--size-touch-xs);
  }

  :global(.StatusBar .ThemeToggle__option svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  :global(.StatusBar__spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
