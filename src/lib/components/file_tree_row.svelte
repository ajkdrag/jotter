<script lang="ts">
  import type { FlatTreeNode } from "$lib/types/filetree";
  import type { NoteMeta } from "$lib/types/note";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import {
    ChevronRight,
    ChevronDown,
    Folder,
    File,
    Trash2,
    Pencil,
    Loader2,
    AlertCircle,
    RefreshCw
  } from "@lucide/svelte";

  type Props = {
    node: FlatTreeNode;
    is_selected: boolean;
    on_toggle_folder: (path: string) => void;
    on_select_note: (path: string) => void;
    on_select_folder: (path: string) => void;
    on_request_delete?: ((note: NoteMeta) => void) | undefined;
    on_request_rename?: ((note: NoteMeta) => void) | undefined;
    on_retry_load: (path: string) => void;
  };

  let {
    node,
    is_selected,
    on_toggle_folder,
    on_select_note,
    on_select_folder,
    on_request_delete,
    on_request_rename,
    on_retry_load
  }: Props = $props();

  const INDENT_PX = 16;
  const BASE_PADDING_PX = 8;

  function handle_click() {
    if (node.is_folder) {
      on_select_folder(node.path);
    } else if (node.note) {
      on_select_note(node.path);
    }
  }

  function handle_toggle(e: MouseEvent) {
    e.stopPropagation();
    on_toggle_folder(node.path);
  }

  function handle_retry(e: MouseEvent) {
    e.stopPropagation();
    on_retry_load(node.path);
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
      on_toggle_folder(node.path);
    }
  }
</script>

{#snippet row_content()}
  <div
    class="file-tree-row flex h-8 w-full cursor-pointer items-center gap-1 rounded-md px-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    class:bg-sidebar-accent={is_selected}
    class:text-sidebar-accent-foreground={is_selected}
    style="padding-left: {BASE_PADDING_PX + node.depth * INDENT_PX}px"
    role="treeitem"
    tabindex="0"
    aria-selected={is_selected}
    onclick={handle_click}
    onkeydown={handle_keydown}
  >
    {#if node.is_folder}
      <button
        type="button"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent-foreground/10"
        onclick={handle_toggle}
        onkeydown={handle_toggle_keydown}
        aria-label={node.is_expanded ? "Collapse" : "Expand"}
        disabled={node.is_loading}
      >
        {#if node.is_loading}
          <Loader2 class="size-3.5 animate-spin" />
        {:else if node.has_error}
          <AlertCircle class="size-3.5 text-destructive" />
        {:else if node.is_expanded}
          <ChevronDown class="size-3.5" />
        {:else}
          <ChevronRight class="size-3.5" />
        {/if}
      </button>
      <Folder class="size-4 shrink-0" />
      <span class="min-w-0 flex-1 truncate">{node.name}</span>
      {#if node.has_error}
        <button
          type="button"
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onclick={handle_retry}
          aria-label="Retry loading"
        >
          <RefreshCw class="size-3" />
        </button>
      {/if}
    {:else}
      <div class="w-5 shrink-0"></div>
      <File class="size-4 shrink-0" />
      <span class="min-w-0 flex-1 truncate">{node.name}</span>
    {/if}
  </div>
{/snippet}

{#if node.is_folder}
  {@render row_content()}
{:else if node.note}
  <ContextMenu.Root>
    <ContextMenu.Trigger class="w-full">
      {@render row_content()}
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content>
        <ContextMenu.Item onclick={() => on_request_rename?.(node.note!)}>
          <Pencil class="mr-2 h-4 w-4" />
          <span>Rename</span>
        </ContextMenu.Item>
        <ContextMenu.Item onclick={() => on_request_delete?.(node.note!)}>
          <Trash2 class="mr-2 h-4 w-4" />
          <span>Delete</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>
{/if}
