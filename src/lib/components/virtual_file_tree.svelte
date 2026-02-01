<script lang="ts">
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import type { FlatTreeNode } from "$lib/types/filetree";
  import type { NoteMeta } from "$lib/types/note";
  import FileTreeRow from "$lib/components/file_tree_row.svelte";

  type Props = {
    nodes: FlatTreeNode[];
    selected_path: string;
    open_note_path: string;
    on_toggle_folder: (path: string) => void;
    on_select_note: (path: string) => void;
    on_select_folder: (path: string) => void;
    on_request_delete?: ((note: NoteMeta) => void) | undefined;
    on_request_rename?: ((note: NoteMeta) => void) | undefined;
    on_request_delete_folder?: ((folder_path: string) => void) | undefined;
    on_request_rename_folder?: ((folder_path: string) => void) | undefined;
    on_retry_load: (path: string) => void;
  };

  let {
    nodes,
    selected_path,
    open_note_path,
    on_toggle_folder,
    on_select_note,
    on_select_folder,
    on_request_delete,
    on_request_rename,
    on_request_delete_folder,
    on_request_rename_folder,
    on_retry_load
  }: Props = $props();

  const ROW_HEIGHT = 32;
  const OVERSCAN = 5;

  let scroll_container: HTMLDivElement | null = $state(null);

  const virtualizer = $derived(
    scroll_container
      ? createVirtualizer({
          get count() {
            return nodes.length;
          },
          getScrollElement: () => scroll_container,
          estimateSize: () => ROW_HEIGHT,
          overscan: OVERSCAN
        })
      : null
  );

  let virtual_items = $derived.by(() => {
    if (!virtualizer) return []
    return $virtualizer!.getVirtualItems()
  });
  let total_size = $derived.by(() => {
    if (!virtualizer) return nodes.length * ROW_HEIGHT
    return $virtualizer!.getTotalSize()
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
            is_selected={node.is_folder ? selected_path === node.path : open_note_path === node.path}
            {on_toggle_folder}
            {on_select_note}
            {on_select_folder}
            {on_request_delete}
            {on_request_rename}
            {on_request_delete_folder}
            {on_request_rename_folder}
            {on_retry_load}
          />
        </div>
      {/if}
    {/each}
  </div>
</div>
