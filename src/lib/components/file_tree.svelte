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
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import { ChevronRight, ChevronDown, Folder, File, Trash2 } from "lucide-svelte";

  type Props = {
    notes: NoteMeta[];
    onOpenNote: (note_path: string) => void;
    onRequestDelete?: (note: NoteMeta) => void;
  };

  let { notes, onOpenNote, onRequestDelete }: Props = $props();

  let expanded = $state(new Set<string>());
  let tree = $derived(sort_tree(build_filetree(notes)));

  function toggle_folder(path: string) {
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    expanded = new Set(expanded);
  }

  function handle_file_click(note: NoteMeta) {
    onOpenNote(note.path);
  }

  function handle_delete_click(note: NoteMeta) {
    onRequestDelete?.(note);
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
          <ContextMenu.Root>
            <ContextMenu.Trigger class="w-full">
              <SidebarMenuButton onclick={() => handle_file_click(node.note!)}>
                <File />
                <span>{name}</span>
              </SidebarMenuButton>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content>
                <ContextMenu.Item onclick={() => handle_delete_click(node.note!)}>
                  <Trash2 class="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </SidebarMenuItem>
      {/if}
    {/each}
  </SidebarMenu>
{/snippet}

{@render render_tree(tree.children)}
