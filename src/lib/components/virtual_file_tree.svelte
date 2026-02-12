<script lang="ts">
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import type { FlatTreeNode } from "$lib/types/filetree";
  import type { NoteMeta } from "$lib/types/note";
  import FileTreeRow from "$lib/components/file_tree_row.svelte";

  type Props = {
    nodes: FlatTreeNode[];
    selected_path: string;
    open_note_path: string;
    starred_paths?: string[];
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
    on_load_more: (folder_path: string) => void;
    on_retry_load_more: (folder_path: string) => void;
  };

  let {
    nodes,
    selected_path,
    open_note_path,
    starred_paths = [],
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
    on_load_more,
    on_retry_load_more,
  }: Props = $props();

  const ROW_HEIGHT = 30;
  const OVERSCAN = 5;

  let scroll_container: HTMLDivElement | null = $state(null);
  let pending_load_more_scroll_top: number | null = $state(null);
  let previous_nodes_count = -1;

  function restore_scroll_top(min_scroll_top: number) {
    if (min_scroll_top <= 0) {
      return;
    }

    const apply = () => {
      if (!scroll_container) {
        return;
      }
      if (scroll_container.scrollTop < min_scroll_top) {
        scroll_container.scrollTop = min_scroll_top;
      }
    };

    queueMicrotask(apply);
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
  }

  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => scroll_container,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  $effect(() => {
    const v = $virtualizer;
    if (!v) return;

    const next_count = nodes.length;
    const count_changed = next_count !== previous_nodes_count;
    const has_loading_load_more = nodes.some(
      (node) => node.is_load_more && node.is_loading,
    );

    if (!count_changed) {
      if (pending_load_more_scroll_top !== null && !has_loading_load_more) {
        pending_load_more_scroll_top = null;
      }
      return;
    }

    v.setOptions({ count: next_count });
    if (pending_load_more_scroll_top === null) {
      v.measure();
    }

    if (pending_load_more_scroll_top !== null) {
      if (next_count > previous_nodes_count) {
        restore_scroll_top(pending_load_more_scroll_top);
      }
      pending_load_more_scroll_top = null;
    }

    previous_nodes_count = next_count;
  });

  const virtual_items = $derived.by(() => {
    const current_nodes = nodes;
    void current_nodes;

    const v = $virtualizer;
    if (!v) return [];
    return v.getVirtualItems();
  });

  const total_size = $derived.by(() => {
    const current_nodes = nodes;
    void current_nodes;

    const v = $virtualizer;
    if (!v) return nodes.length * ROW_HEIGHT;
    return v.getTotalSize();
  });

  $effect(() => {
    const v = $virtualizer;
    if (!v) return;

    const items = v.getVirtualItems();
    for (const item of items) {
      const node = nodes[item.index];
      if (!node?.is_load_more || node.is_loading || node.has_error) {
        continue;
      }
      if (scroll_container) {
        pending_load_more_scroll_top = Number(scroll_container.scrollTop);
      }
      on_load_more(node.parent_path ?? "");
      break;
    }
  });
</script>

<div
  bind:this={scroll_container}
  class="virtual-file-tree h-full w-full overflow-auto"
  role="tree"
  aria-label="File tree"
>
  <div class="relative w-full" style="height: {total_size}px">
    {#each virtual_items as virtual_row (virtual_row.key)}
      {@const node = nodes[virtual_row.index]}
      {#if node}
        <div
          class="absolute left-0 top-0 w-full"
          style="height: {virtual_row.size}px; transform: translateY({virtual_row.start}px)"
        >
          <FileTreeRow
            {node}
            is_selected={node.is_folder
              ? selected_path === node.path
              : open_note_path === node.path}
            is_starred={starred_paths.includes(node.path)}
            {on_toggle_folder}
            {on_toggle_folder_node}
            {on_select_note}
            {on_select_folder}
            {on_request_delete}
            {on_request_rename}
            {on_request_delete_folder}
            {on_request_rename_folder}
            {on_request_create_note}
            {on_request_create_folder}
            {on_toggle_star}
            {on_retry_load}
            {on_retry_load_more}
          />
        </div>
      {/if}
    {/each}
  </div>
</div>
