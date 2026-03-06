<script lang="ts">
  import { GitBranch, ArrowUp, ArrowDown } from "@lucide/svelte";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import type { GitSyncStatus } from "$lib/features/git/types/git";

  interface Props {
    enabled: boolean;
    branch: string;
    is_dirty: boolean;
    pending_files: number;
    sync_status: GitSyncStatus;
    has_remote: boolean;
    ahead: number;
    behind: number;
    on_click: () => void;
    on_push: () => void;
    on_pull: () => void;
  }

  let {
    enabled,
    branch,
    is_dirty,
    pending_files,
    sync_status,
    has_remote,
    ahead,
    behind,
    on_click,
    on_push,
    on_pull,
  }: Props = $props();

  const is_syncing = $derived(
    sync_status === "committing" ||
      sync_status === "pushing" ||
      sync_status === "pulling",
  );
  const status_label = $derived.by(() => {
    if (sync_status === "committing") return "Committing...";
    if (sync_status === "pushing") return "Pushing...";
    if (sync_status === "pulling") return "Pulling...";
    if (sync_status === "error") return "Error";
    return null;
  });
</script>

{#if enabled}
  <div class="GitStatusGroup">
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
      {#if status_label}
        <span class="GitStatusWidget__state">{status_label}</span>
      {/if}
      {#if pending_files > 0}
        <span class="GitStatusWidget__badge">{pending_files}</span>
      {/if}
    </button>

    {#if has_remote}
      <div class="GitStatusGroup__remote">
        <Tooltip.Provider delayDuration={0}>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  class="GitStatusGroup__btn"
                  onclick={on_pull}
                  disabled={is_syncing}
                  aria-label="Git pull{behind > 0 ? ` (${behind} behind)` : ''}"
                >
                  <ArrowDown class="GitStatusGroup__btn-icon" />
                  {#if behind > 0}
                    <span class="GitStatusGroup__count">{behind}</span>
                  {/if}
                </button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={4}>
              Pull{behind > 0 ? ` (${behind} behind)` : ""}
            </Tooltip.Content>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  class="GitStatusGroup__btn"
                  onclick={on_push}
                  disabled={is_syncing}
                  aria-label="Git push{ahead > 0 ? ` (${ahead} ahead)` : ''}"
                >
                  <ArrowUp class="GitStatusGroup__btn-icon" />
                  {#if ahead > 0}
                    <span class="GitStatusGroup__count">{ahead}</span>
                  {/if}
                </button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={4}>
              Push{ahead > 0 ? ` (${ahead} ahead)` : ""}
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    {/if}
  </div>
{/if}

<style>
  .GitStatusGroup {
    display: inline-flex;
    align-items: center;
    gap: var(--space-0-5);
  }

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
    width: var(--space-1-5);
    height: var(--space-1-5);
    border-radius: 50%;
    flex-shrink: 0;
    transition: background-color var(--duration-normal) var(--ease-default);
  }

  .GitStatusWidget__indicator--dirty {
    background-color: var(--indicator-dirty);
  }

  .GitStatusWidget__indicator--clean {
    background-color: var(--indicator-clean);
  }

  .GitStatusWidget__badge {
    font-size: var(--text-xs);
    line-height: 1;
    padding: 1px var(--space-1);
    border-radius: var(--radius-sm);
    background-color: var(--muted);
    color: var(--muted-foreground);
  }

  .GitStatusWidget__state {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .GitStatusGroup__remote {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }

  .GitStatusGroup__btn {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    padding: var(--space-0-5);
    border-radius: var(--radius-sm);
    opacity: 0.6;
    transition:
      opacity var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .GitStatusGroup__btn:hover:not(:disabled) {
    opacity: 1;
    color: var(--interactive);
  }

  .GitStatusGroup__btn:focus-visible {
    opacity: 1;
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .GitStatusGroup__btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  :global(.GitStatusGroup__btn-icon) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  .GitStatusGroup__count {
    font-size: var(--text-xs);
    line-height: 1;
    font-feature-settings: "tnum" 1;
  }
</style>
