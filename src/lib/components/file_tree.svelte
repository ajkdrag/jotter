<script lang="ts">
  import type { NoteMeta } from "$lib/types/note";
  import type { FileTreeNode } from "$lib/utils/filetree";
  import { build_filetree, sort_tree } from "$lib/utils/filetree";
  import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
  } from "$lib/components/ui/sidebar";
  import { ChevronRight, ChevronDown, Folder, File } from "lucide-svelte";
  import { create_open_note_workflow } from "$lib/workflows/create_open_note_workflow";

  type Props = {
    notes: NoteMeta[];
  };

  let { notes }: Props = $props();

  let expanded = $state(new Set<string>());
  let tree = $derived(sort_tree(build_filetree(notes)));
  const open_note_workflow = create_open_note_workflow();

  function toggle_folder(path: string) {
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    expanded = new Set(expanded);
  }

  function handle_file_click(note: NoteMeta) {
    void open_note_workflow.open(note.path);
  }
</script>

{#snippet render_tree(nodes: Map<string, FileTreeNode>)}
  <SidebarMenu>
    {#each Array.from(nodes.entries()) as [name, node]}
      {#if node.isFolder}
        <SidebarMenuItem>
          <SidebarMenuButton onclick={() => toggle_folder(node.path)}>
            {#if expanded.has(node.path)}
              <ChevronDown />
            {:else}
              <ChevronRight />
            {/if}
            <Folder />
            <span>{name}</span>
          </SidebarMenuButton>
          {#if expanded.has(node.path) && node.children.size > 0}
            <SidebarMenuSub>
              {@render render_tree(node.children)}
            </SidebarMenuSub>
          {/if}
        </SidebarMenuItem>
      {:else if node.note}
        <SidebarMenuItem>
          <SidebarMenuButton onclick={() => handle_file_click(node.note!)}>
            <File />
            <span>{name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      {/if}
    {/each}
  </SidebarMenu>
{/snippet}

{@render render_tree(tree.children)}
