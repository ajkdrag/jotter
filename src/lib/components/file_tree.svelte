<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
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
  import { ChevronRight, ChevronDown, Folder, File, Trash2, Pencil } from "@lucide/svelte";

  type Props = {
    notes: NoteMeta[];
    folder_paths?: string[];
    selected_root: string;
    on_select_root: (path: string) => void;
    on_open_note: (note_path: string) => void;
    on_request_delete: ((note: NoteMeta) => void) | undefined;
    on_request_rename: ((note: NoteMeta) => void) | undefined;
  };

  let {
    notes,
    folder_paths = [],
    selected_root,
    on_select_root,
    on_open_note,
    on_request_delete,
    on_request_rename
  }: Props = $props();

  let expanded = new SvelteSet<string>();
  let tree = $derived(sort_tree(build_filetree(notes, folder_paths)));

  function toggle_folder(path: string) {
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
  }
</script>

{#snippet render_tree(nodes: Map<string, FileTreeNode>)}
  <SidebarMenu>
    {#each Array.from(nodes.entries()) as [name, node] (name)}
      {#if node.is_folder}
        <SidebarMenuItem>
          <div class="flex w-full items-center gap-0">
            <button
              type="button"
              class="flex h-8 w-7 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onclick={() => toggle_folder(node.path)}
              aria-label={expanded.has(node.path) ? 'Collapse' : 'Expand'}
            >
              {#if expanded.has(node.path)}
                <ChevronDown class="size-4" />
              {:else}
                <ChevronRight class="size-4" />
              {/if}
            </button>
            <SidebarMenuButton
              isActive={selected_root === node.path}
              class="flex-1 min-w-0 rounded-md"
              onclick={() => on_select_root(node.path)}
            >
              <Folder />
              <span>{name}</span>
            </SidebarMenuButton>
          </div>
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
              <SidebarMenuButton onclick={() => on_open_note(node.note!.path)}>
                <File />
                <span>{name}</span>
              </SidebarMenuButton>
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
        </SidebarMenuItem>
      {/if}
    {/each}
  </SidebarMenu>
{/snippet}

{@render render_tree(tree.children)}
