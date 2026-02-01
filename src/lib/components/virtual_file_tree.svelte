<script lang="ts">
  import { createVirtualizer, type VirtualItem } from "@tanstack/svelte-virtual";
  import { onMount } from "svelte";
  import type { FlatTreeNode } from "$lib/types/filetree";
  import type { NoteMeta } from "$lib/types/note";
  import FileTreeRow from "$lib/components/file_tree_row.svelte";

  type Props = {
    nodes: FlatTreeNode[];
    selected_path: string;
    on_toggle_folder: (path: string) => void;
    on_select_note: (path: string) => void;
    on_select_folder: (path: string) => void;
    on_request_delete?: ((note: NoteMeta) => void) | undefined;
    on_request_rename?: ((note: NoteMeta) => void) | undefined;
    on_retry_load: (path: string) => void;
  };

  let {
    nodes,
    selected_path,
    on_toggle_folder,
    on_select_note,
    on_select_folder,
    on_request_delete,
    on_request_rename,
    on_retry_load
  }: Props = $props();

  const ROW_HEIGHT = 32;
  const OVERSCAN = 5;

  let scroll_container: HTMLDivElement | null = $state(null);
  let is_mounted = $state(false);

  onMount(() => {
    requestAnimationFrame(() => {
      is_mounted = true;
    });
  });

  const virtualizer_store = $derived(
    createVirtualizer({
      get count() {
        return nodes.length;
      },
      getScrollElement: () => scroll_container,
      estimateSize: () => ROW_HEIGHT,
      overscan: OVERSCAN
    })
  );

  let virtual_items: VirtualItem[] = $derived(is_mounted ? $virtualizer_store.getVirtualItems() : []);
  let total_size = $derived(is_mounted ? $virtualizer_store.getTotalSize() : nodes.length * ROW_HEIGHT);
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
            is_selected={selected_path === node.path}
            {on_toggle_folder}
            {on_select_note}
            {on_select_folder}
            {on_request_delete}
            {on_request_rename}
            {on_retry_load}
          />
        </div>
      {/if}
    {/each}
  </div>
</div>
