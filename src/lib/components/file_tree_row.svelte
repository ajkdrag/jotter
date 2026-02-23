<script lang="ts">
  import type { FlatTreeNode } from "$lib/types/filetree";
  import type { NoteMeta } from "$lib/types/note";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import {
    ChevronRight,
    ChevronDown,
    FileText,
    Trash2,
    Pencil,
    LoaderCircle,
    CircleAlert,
    RefreshCw,
    FilePlus,
    FolderPlus,
    Star,
    StarOff,
  } from "@lucide/svelte";

  type Props = {
    node: FlatTreeNode;
    is_selected: boolean;
    is_starred?: boolean;
    on_toggle_folder: (path: string) => void;
    on_toggle_folder_node?: ((node: FlatTreeNode) => void) | undefined;
    on_select_note: (path: string) => void;
    on_select_folder: (path: string) => void;
    on_request_delete?: ((note: NoteMeta) => void) | undefined;
    on_request_rename?: ((note: NoteMeta) => void) | undefined;
    on_request_delete_folder?: ((folder_path: string) => void) | undefined;
    on_request_rename_folder?: ((folder_path: string) => void) | undefined;
    on_request_create_note?: ((folder_path: string) => void) | undefined;
    on_request_create_folder?: ((folder_path: string) => void) | undefined;
    on_toggle_star?: ((path: string) => void) | undefined;
    on_retry_load: (path: string) => void;
    on_retry_load_more: (folder_path: string) => void;
  };

  let {
    node,
    is_selected,
    is_starred = false,
    on_toggle_folder,
    on_toggle_folder_node,
    on_select_note,
    on_select_folder,
    on_request_delete,
    on_request_rename,
    on_request_delete_folder,
    on_request_rename_folder,
    on_request_create_note,
    on_request_create_folder,
    on_toggle_star,
    on_retry_load,
    on_retry_load_more,
  }: Props = $props();

  function handle_click() {
    if (node.is_folder) {
      if (on_toggle_folder_node) {
        on_toggle_folder_node(node);
      } else {
        on_toggle_folder(node.path);
      }
      on_select_folder(node.path);
    } else if (node.note) {
      on_select_note(node.path);
    }
  }

  function handle_toggle(e: MouseEvent) {
    e.stopPropagation();
    if (on_toggle_folder_node) {
      on_toggle_folder_node(node);
    } else {
      on_toggle_folder(node.path);
    }
    on_select_folder(node.path);
  }

  function handle_retry(e: MouseEvent) {
    e.stopPropagation();
    on_retry_load(node.path);
  }

  function handle_retry_load_more() {
    on_retry_load_more(node.parent_path ?? "");
  }

  function handle_keydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handle_click();
    }
  }

  function handle_toggle_keydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (on_toggle_folder_node) {
        on_toggle_folder_node(node);
      } else {
        on_toggle_folder(node.path);
      }
      on_select_folder(node.path);
    }
  }
</script>

{#snippet row_content()}
  <div
    class="TreeRow"
    class:TreeRow--selected={is_selected}
    class:TreeRow--folder={node.is_folder}
    style="--tree-depth: {node.depth}"
    role="treeitem"
    tabindex="0"
    aria-selected={is_selected}
    onclick={handle_click}
    onkeydown={handle_keydown}
  >
    {#if node.is_folder}
      {#if node.has_error}
        <button
          type="button"
          class="TreeRow__toggle"
          onclick={handle_retry}
          title={node.error_message ?? "Failed to load folder"}
          aria-label="Retry loading"
        >
          <CircleAlert class="TreeRow__icon TreeRow__icon--error" />
        </button>
      {:else}
        <button
          type="button"
          class="TreeRow__toggle"
          onclick={handle_toggle}
          onkeydown={handle_toggle_keydown}
          aria-label={node.is_expanded ? "Collapse" : "Expand"}
          disabled={node.is_loading}
        >
          {#if node.is_loading}
            <LoaderCircle class="TreeRow__icon TreeRow__icon--spin" />
          {:else if node.is_expanded}
            <ChevronDown class="TreeRow__icon" />
          {:else}
            <ChevronRight class="TreeRow__icon" />
          {/if}
        </button>
      {/if}
      <span class="TreeRow__label">{node.name}</span>
      {#if is_starred}
        <Star class="TreeRow__star-icon" />
      {/if}
      {#if node.has_error}
        <button
          type="button"
          class="TreeRow__action"
          onclick={handle_retry}
          aria-label="Retry loading"
        >
          <RefreshCw />
        </button>
      {/if}
    {:else}
      <FileText class="TreeRow__type-icon TreeRow__type-icon--after" />
      <span class="TreeRow__label">{node.name}</span>
      {#if is_starred}
        <Star class="TreeRow__star-icon" />
      {/if}
    {/if}
  </div>
{/snippet}

{#if node.is_load_more}
  <div
    class="TreeRow TreeRow--load-more"
    style="--tree-depth: {node.depth}"
    role="presentation"
  >
    {#if node.has_error}
      <button
        type="button"
        class="TreeRow__toggle"
        onclick={handle_retry_load_more}
        aria-label="Retry loading more"
      >
        <RefreshCw class="TreeRow__icon TreeRow__icon--error" />
      </button>
      <span class="TreeRow__label TreeRow__label--muted">
        {node.error_message ?? "Failed to load more. Retry."}
      </span>
    {:else}
      <span class="TreeRow__spacer"></span>
      <LoaderCircle class="TreeRow__icon TreeRow__icon--spin" />
      <span class="TreeRow__label TreeRow__label--muted">Loading more...</span>
    {/if}
  </div>
{:else if node.is_folder}
  <ContextMenu.Root>
    <ContextMenu.Trigger class="w-full">
      {@render row_content()}
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content>
        <ContextMenu.Item
          onSelect={() => {
            if (on_request_create_note) {
              on_request_create_note(node.path);
            }
          }}
        >
          <FilePlus class="mr-2 h-4 w-4" />
          <span>New Note</span>
        </ContextMenu.Item>
        <ContextMenu.Item
          onSelect={() => {
            if (on_request_create_folder) {
              on_request_create_folder(node.path);
            }
          }}
        >
          <FolderPlus class="mr-2 h-4 w-4" />
          <span>New Folder</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          onSelect={() => {
            if (on_toggle_star) {
              on_toggle_star(node.path);
            }
          }}
        >
          {#if is_starred}
            <StarOff class="mr-2 h-4 w-4" />
            <span>Unstar</span>
          {:else}
            <Star class="mr-2 h-4 w-4" />
            <span>Star</span>
          {/if}
        </ContextMenu.Item>
        {#if on_request_rename_folder || on_request_delete_folder}
          <ContextMenu.Separator />
          {#if on_request_rename_folder}
            <ContextMenu.Item
              onSelect={() => {
                on_request_rename_folder(node.path);
              }}
            >
              <Pencil class="mr-2 h-4 w-4" />
              <span>Rename</span>
            </ContextMenu.Item>
          {/if}
          {#if on_request_delete_folder}
            <ContextMenu.Item
              onSelect={() => {
                on_request_delete_folder(node.path);
              }}
            >
              <Trash2 class="mr-2 h-4 w-4" />
              <span>Delete</span>
            </ContextMenu.Item>
          {/if}
        {/if}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>
{:else if node.note}
  <ContextMenu.Root>
    <ContextMenu.Trigger class="w-full">
      {@render row_content()}
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content>
        <ContextMenu.Item
          onSelect={() => {
            if (on_toggle_star) {
              on_toggle_star(node.path);
            }
          }}
        >
          {#if is_starred}
            <StarOff class="mr-2 h-4 w-4" />
            <span>Unstar</span>
          {:else}
            <Star class="mr-2 h-4 w-4" />
            <span>Star</span>
          {/if}
        </ContextMenu.Item>
        {#if on_request_rename || on_request_delete}
          <ContextMenu.Separator />
          {#if on_request_rename}
            <ContextMenu.Item
              onSelect={() => {
                if (node.note) {
                  on_request_rename(node.note);
                }
              }}
            >
              <Pencil class="mr-2 h-4 w-4" />
              <span>Rename</span>
            </ContextMenu.Item>
          {/if}
          {#if on_request_delete}
            <ContextMenu.Item
              onSelect={() => {
                if (node.note) {
                  on_request_delete(node.note);
                }
              }}
            >
              <Trash2 class="mr-2 h-4 w-4" />
              <span>Delete</span>
            </ContextMenu.Item>
          {/if}
        {/if}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>
{/if}

<style>
  .TreeRow {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    height: var(--size-tree-row);
    padding-inline-start: calc(
      var(--size-tree-base-padding) + var(--tree-depth) *
        var(--size-tree-indent)
    );
    padding-inline-end: var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--sidebar-foreground);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .TreeRow::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: calc(
      var(--size-tree-base-padding) + var(--size-icon-md) / 2
    );
    width: calc(var(--tree-depth) * var(--size-tree-indent));
    pointer-events: none;
    background-image: linear-gradient(
      to right,
      var(--border-subtle) 0,
      var(--border-subtle) 1px,
      transparent 1px
    );
    background-size: var(--size-tree-indent) 100%;
  }

  .TreeRow:hover {
    background-color: var(--sidebar-accent);
  }

  .TreeRow:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .TreeRow--selected {
    background-color: var(--interactive-bg);
    color: var(--interactive);
  }

  .TreeRow--selected:hover {
    background-color: var(--interactive-bg-hover);
  }

  .TreeRow--load-more {
    cursor: default;
    color: var(--muted-foreground);
  }

  .TreeRow--load-more:hover {
    background-color: transparent;
  }

  .TreeRow__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-icon-md);
    height: var(--size-icon-md);
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .TreeRow__toggle:hover:not(:disabled) {
    background-color: color-mix(
      in oklch,
      var(--sidebar-accent-foreground) 10%,
      transparent
    );
  }

  .TreeRow__toggle:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .TreeRow__spacer {
    width: var(--size-icon-md);
    flex-shrink: 0;
  }

  .TreeRow__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .TreeRow--folder .TreeRow__label {
    font-weight: 500;
  }

  .TreeRow__label--muted {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .TreeRow__action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-icon-md);
    height: var(--size-icon-md);
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-default);
  }

  .TreeRow__action:hover {
    color: var(--foreground);
  }

  :global(.TreeRow__icon) {
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
  }

  :global(.TreeRow__icon--spin) {
    animation: spin 1s linear infinite;
  }

  :global(.TreeRow__icon--error) {
    color: var(--destructive);
  }

  :global(.TreeRow__type-icon) {
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
    flex-shrink: 0;
    opacity: 0.5;
  }

  :global(.TreeRow__star-icon) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
    flex-shrink: 0;
    color: var(--warning);
    fill: currentColor;
    margin-inline-start: var(--space-1);
    opacity: 0.8;
  }

  :global(.TreeRow__action svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
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
