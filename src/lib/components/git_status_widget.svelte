<script lang="ts">
  import { GitBranch } from "@lucide/svelte";
  import type { GitSyncStatus } from "$lib/types/git";

  interface Props {
    enabled: boolean;
    branch: string;
    is_dirty: boolean;
    pending_files: number;
    sync_status: GitSyncStatus;
    on_click: () => void;
  }

  let {
    enabled,
    branch,
    is_dirty,
    pending_files,
    sync_status,
    on_click,
  }: Props = $props();

  const is_syncing = $derived(
    sync_status === "committing" ||
      sync_status === "pushing" ||
      sync_status === "pulling",
  );
</script>

{#if enabled}
  <button
    type="button"
    class="GitStatusWidget"
    class:GitStatusWidget--syncing={is_syncing}
    class:GitStatusWidget--error={sync_status === "error"}
    onclick={on_click}
    aria-label="Git status: {branch}{is_dirty ? ' (modified)' : ''}"
  >
    <GitBranch class="GitStatusWidget__icon" />
    <span class="GitStatusWidget__branch">{branch}</span>
    <span
      class="GitStatusWidget__indicator"
      class:GitStatusWidget__indicator--dirty={is_dirty}
      class:GitStatusWidget__indicator--clean={!is_dirty}
    ></span>
    {#if pending_files > 0}
      <span class="GitStatusWidget__badge">{pending_files}</span>
    {/if}
  </button>
{/if}

<style>
  .GitStatusWidget {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border-radius: var(--radius-sm);
    opacity: 0.7;
    transition:
      opacity var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .GitStatusWidget:hover {
    opacity: 1;
    color: var(--interactive);
  }

  .GitStatusWidget:focus-visible {
    opacity: 1;
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .GitStatusWidget--syncing {
    color: var(--primary);
  }

  .GitStatusWidget--error {
    color: var(--destructive);
  }

  :global(.GitStatusWidget__icon) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  .GitStatusWidget__branch {
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
  }

  .GitStatusWidget__indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background-color var(--duration-normal) var(--ease-default);
  }

  .GitStatusWidget__indicator--dirty {
    background-color: var(--chart-4);
  }

  .GitStatusWidget__indicator--clean {
    background-color: var(--chart-2);
  }

  .GitStatusWidget__badge {
    font-size: var(--text-xs);
    line-height: 1;
    padding: 1px var(--space-1);
    border-radius: var(--radius-sm);
    background-color: var(--muted);
    color: var(--muted-foreground);
  }
</style>
