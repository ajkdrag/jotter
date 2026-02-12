<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import * as Resizable from "$lib/components/ui/resizable/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import { Button } from "$lib/components/ui/button";
  import ActivityBar from "$lib/components/activity_bar.svelte";
  import VirtualFileTree from "$lib/components/virtual_file_tree.svelte";
  import NoteEditor from "$lib/components/note_editor.svelte";
  import FindInFileBar from "$lib/components/find_in_file_bar.svelte";
  import EditorStatusBar from "$lib/components/editor_status_bar.svelte";
  import NoteDetailsDialog from "$lib/components/note_details_dialog.svelte";
  import ThemeToggle from "$lib/components/theme_toggle.svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { build_filetree, sort_tree } from "$lib/domain/filetree";
  import { flatten_filetree } from "$lib/domain/flatten_filetree";
  import { as_note_path } from "$lib/types/ids";
  import { count_words } from "$lib/utils/count_words";
  import { use_app_context } from "$lib/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/actions/action_ids";
  import type { NoteMeta } from "$lib/types/note";
  import {
    Circle,
    FilePlus,
    FolderPlus,
    RefreshCw,
    FoldVertical,
    Copy,
    Pencil,
    Trash2,
    Star,
  } from "@lucide/svelte";

  const { stores, action_registry } = use_app_context();

  let starred_expanded_node_ids = $state(new SvelteSet<string>());

  function starred_node_id(root_path: string, relative_path: string): string {
    return `starred:${root_path}:${relative_path}`;
  }

  function is_note_path(path: string): boolean {
    return path.endsWith(".md");
  }

  function toggle_star_for_path(path: string) {
    if (is_note_path(path)) {
      void action_registry.execute(ACTION_IDS.note_toggle_star, path);
      return;
    }
    void action_registry.execute(ACTION_IDS.folder_toggle_star, path);
  }

  function toggle_starred_folder_node(node: {
    id: string;
    path: string;
    is_folder: boolean;
  }) {
    if (!node.is_folder) {
      return;
    }

    if (starred_expanded_node_ids.has(node.id)) {
      starred_expanded_node_ids.delete(node.id);
      return;
    }

    starred_expanded_node_ids.add(node.id);
    void action_registry.execute(ACTION_IDS.folder_retry_load, node.path);
  }

  const flat_nodes = $derived(
    flatten_filetree({
      notes: stores.notes.notes,
      folder_paths: stores.notes.folder_paths,
      expanded_paths: stores.ui.filetree.expanded_paths,
      load_states: stores.ui.filetree.load_states,
      error_messages: stores.ui.filetree.error_messages,
      show_hidden_files: stores.ui.editor_settings.show_hidden_files,
      pagination: stores.ui.filetree.pagination,
    }),
  );

  const starred_nodes = $derived.by(() => {
    const starred_paths = stores.notes.starred_paths;
    if (starred_paths.length === 0) {
      return [];
    }

    const root_paths = [...starred_paths].sort((a, b) => {
      const a_is_folder = !is_note_path(a);
      const b_is_folder = !is_note_path(b);
      if (a_is_folder !== b_is_folder) {
        return a_is_folder ? -1 : 1;
      }
      return a.localeCompare(b);
    });

    const result = [];
    for (const root_path of root_paths) {
      const is_folder = !is_note_path(root_path);

      if (!is_folder) {
        const note_meta =
          stores.notes.notes.find((note) => note.path === root_path) ??
          ({
            id: root_path,
            path: root_path,
            name: (root_path.split("/").at(-1) ?? root_path).replace(
              /\.md$/i,
              "",
            ),
            title: (root_path.split("/").at(-1) ?? root_path).replace(
              /\.md$/i,
              "",
            ),
            mtime_ms: 0,
            size_bytes: 0,
          } as NoteMeta);

        result.push({
          id: `starred:${root_path}`,
          path: root_path,
          name: note_meta.name,
          depth: 0,
          is_folder: false,
          is_expanded: false,
          is_loading: false,
          has_error: false,
          error_message: null,
          note: note_meta,
          parent_path: null,
          is_load_more: false,
        });
        continue;
      }

      const root_id = starred_node_id(root_path, "");
      const root_load_state =
        stores.ui.filetree.load_states.get(root_path) ?? "unloaded";
      const root_is_expanded = starred_expanded_node_ids.has(root_id);

      result.push({
        id: root_id,
        path: root_path,
        name: root_path.split("/").at(-1) ?? root_path,
        depth: 0,
        is_folder: true,
        is_expanded: root_is_expanded,
        is_loading: root_load_state === "loading",
        has_error: root_load_state === "error",
        error_message: stores.ui.filetree.error_messages.get(root_path) ?? null,
        note: null,
        parent_path: null,
        is_load_more: false,
      });

      if (!root_is_expanded) {
        continue;
      }

      const relative_notes = stores.notes.notes
        .filter((note) => note.path.startsWith(`${root_path}/`))
        .map((note) => {
          const relative_path = note.path.slice(root_path.length + 1);
          return {
            ...note,
            id: as_note_path(relative_path),
            path: as_note_path(relative_path),
          };
        });
      const relative_folders = stores.notes.folder_paths
        .filter((path) => path.startsWith(`${root_path}/`))
        .map((path) => path.slice(root_path.length + 1));

      const tree = sort_tree(build_filetree(relative_notes, relative_folders));

      function visit(
        tree_node: ReturnType<typeof build_filetree>,
        parent_actual_path: string,
        depth: number,
      ) {
        for (const [, child] of tree_node.children) {
          if (
            !stores.ui.editor_settings.show_hidden_files &&
            child.name.startsWith(".")
          ) {
            continue;
          }

          const actual_path = `${root_path}/${child.path}`;
          const node_id = starred_node_id(root_path, child.path);
          const load_state =
            stores.ui.filetree.load_states.get(actual_path) ?? "unloaded";
          const is_expanded =
            child.is_folder && starred_expanded_node_ids.has(node_id);

          result.push({
            id: node_id,
            path: actual_path,
            name: child.name,
            depth,
            is_folder: child.is_folder,
            is_expanded,
            is_loading: load_state === "loading",
            has_error: load_state === "error",
            error_message:
              stores.ui.filetree.error_messages.get(actual_path) ?? null,
            note: child.note
              ? ({
                  ...child.note,
                  id: actual_path,
                  path: actual_path,
                } as NoteMeta)
              : null,
            parent_path: parent_actual_path,
            is_load_more: false,
          });

          if (child.is_folder && is_expanded) {
            visit(child, actual_path, depth + 1);
          }
        }

        const pagination_state =
          stores.ui.filetree.pagination.get(parent_actual_path);
        if (
          pagination_state &&
          pagination_state.loaded_count < pagination_state.total_count
        ) {
          const load_more_id = starred_node_id(
            root_path,
            `__load_more__:${parent_actual_path || "root"}`,
          );
          result.push({
            id: load_more_id,
            path: load_more_id,
            name: "",
            depth,
            is_folder: false,
            is_expanded: false,
            is_loading: pagination_state.load_state === "loading",
            has_error: pagination_state.load_state === "error",
            error_message: pagination_state.error_message,
            note: null,
            parent_path: parent_actual_path,
            is_load_more: true,
          });
        }
      }

      visit(tree, root_path, 1);
    }

    return result;
  });

  $effect(() => {
    const valid_ids = new Set(starred_nodes.map((node) => node.id));
    for (const id of starred_expanded_node_ids) {
      if (!valid_ids.has(id)) {
        starred_expanded_node_ids.delete(id);
      }
    }
  });

  const open_note_title = $derived(
    stores.editor.open_note?.meta.title ?? "Notes",
  );
  const word_count = $derived(
    stores.editor.open_note ? count_words(stores.editor.open_note.markdown) : 0,
  );
  const is_persisted_note = $derived(
    stores.editor.open_note != null &&
      stores.editor.open_note.meta.path.endsWith(".md"),
  );

  let details_dialog_open = $state(false);

  function handle_theme_change(theme: "light" | "dark" | "system") {
    void action_registry.execute(ACTION_IDS.ui_set_theme, theme);
  }

  type HeaderAction = {
    icon: typeof FilePlus;
    label: string;
    onclick: () => void;
  };

  const explorer_header_actions: HeaderAction[] = [
    {
      icon: FilePlus,
      label: "New Note",
      onclick: () => void action_registry.execute(ACTION_IDS.note_create),
    },
    {
      icon: FolderPlus,
      label: "New Folder",
      onclick: () =>
        void action_registry.execute(
          ACTION_IDS.folder_request_create,
          stores.ui.selected_folder_path,
        ),
    },
    {
      icon: RefreshCw,
      label: "Refresh",
      onclick: () =>
        void action_registry.execute(ACTION_IDS.folder_refresh_tree),
    },
    {
      icon: FoldVertical,
      label: "Collapse All",
      onclick: () =>
        void action_registry.execute(ACTION_IDS.folder_collapse_all),
    },
  ];

  const starred_header_actions: HeaderAction[] = [
    {
      icon: RefreshCw,
      label: "Refresh",
      onclick: () =>
        void action_registry.execute(ACTION_IDS.folder_refresh_tree),
    },
    {
      icon: FoldVertical,
      label: "Collapse All",
      onclick: () =>
        void action_registry.execute(ACTION_IDS.folder_collapse_all),
    },
  ];

  const sidebar_header_actions = $derived(
    stores.ui.sidebar_view === "starred"
      ? starred_header_actions
      : explorer_header_actions,
  );
</script>

{#if stores.vault.vault}
  <div class="flex h-screen flex-col">
    <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <ActivityBar
        sidebar_open={stores.ui.sidebar_open}
        active_view={stores.ui.sidebar_view}
        on_open_explorer={() => {
          if (stores.ui.sidebar_open && stores.ui.sidebar_view === "explorer") {
            void action_registry.execute(ACTION_IDS.ui_toggle_sidebar);
            return;
          }
          void action_registry.execute(
            ACTION_IDS.ui_set_sidebar_view,
            "explorer",
          );
        }}
        on_open_starred={() => {
          if (stores.ui.sidebar_open && stores.ui.sidebar_view === "starred") {
            void action_registry.execute(ACTION_IDS.ui_toggle_sidebar);
            return;
          }
          void action_registry.execute(
            ACTION_IDS.ui_set_sidebar_view,
            "starred",
          );
        }}
        on_open_settings={() =>
          void action_registry.execute(ACTION_IDS.settings_open)}
      />
      <Sidebar.Provider open={stores.ui.sidebar_open} class="flex-1 min-h-0">
        <Resizable.PaneGroup direction="horizontal" class="h-full">
          {#if stores.ui.sidebar_open}
            <Resizable.Pane
              defaultSize={15}
              minSize={10}
              maxSize={40}
              order={1}
            >
              <Sidebar.Root collapsible="none" class="w-full">
                <Sidebar.Header>
                  <div
                    class="flex w-full items-center justify-between gap-2 px-4 py-2"
                  >
                    {#if stores.ui.sidebar_view === "starred"}
                      <span class="min-w-0 truncate text-left font-semibold">
                        Starred
                      </span>
                    {:else}
                      <button
                        type="button"
                        class="min-w-0 truncate text-left font-semibold transition-colors hover:text-foreground/90"
                        onclick={() => {
                          void action_registry.execute(
                            ACTION_IDS.ui_select_folder,
                            "",
                          );
                        }}
                        aria-label="Select vault root"
                      >
                        {stores.vault.vault.name}
                      </button>
                    {/if}
                    <div class="flex shrink-0 items-center">
                      {#each sidebar_header_actions as action (action.label)}
                        <Tooltip.Root>
                          <Tooltip.Trigger>
                            {#snippet child({ props })}
                              <Button
                                {...props}
                                variant="ghost"
                                size="icon"
                                class="SidebarHeaderButton h-7 w-7"
                                onclick={action.onclick}
                              >
                                <action.icon class="SidebarHeaderIcon" />
                              </Button>
                            {/snippet}
                          </Tooltip.Trigger>
                          <Tooltip.Content>{action.label}</Tooltip.Content>
                        </Tooltip.Root>
                      {/each}
                    </div>
                  </div>
                </Sidebar.Header>

                <Sidebar.Content class="overflow-hidden">
                  {#if stores.ui.sidebar_view === "starred"}
                    <Sidebar.Group class="h-full">
                      <Sidebar.GroupContent class="h-full">
                        <VirtualFileTree
                          nodes={starred_nodes}
                          selected_path={stores.ui.selected_folder_path}
                          open_note_path={stores.editor.open_note?.meta.path ??
                            ""}
                          starred_paths={stores.notes.starred_paths}
                          on_toggle_folder={(path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.folder_toggle,
                              path,
                            )}
                          on_toggle_folder_node={toggle_starred_folder_node}
                          on_select_note={(note_path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.note_open,
                              note_path,
                            )}
                          on_select_folder={(path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.ui_select_folder,
                              path,
                            )}
                          on_request_create_note={(folder_path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.note_create,
                              folder_path,
                            )}
                          on_request_create_folder={(folder_path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.folder_request_create,
                              folder_path,
                            )}
                          on_toggle_star={toggle_star_for_path}
                          on_retry_load={(path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.folder_retry_load,
                              path,
                            )}
                          on_load_more={(path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.folder_load_more,
                              path,
                            )}
                          on_retry_load_more={(path: string) =>
                            void action_registry.execute(
                              ACTION_IDS.folder_load_more,
                              path,
                            )}
                        />
                      </Sidebar.GroupContent>
                    </Sidebar.Group>
                  {/if}

                  <Sidebar.Group
                    class="h-full"
                    hidden={stores.ui.sidebar_view === "starred"}
                  >
                    <Sidebar.GroupContent class="h-full">
                      <VirtualFileTree
                        nodes={flat_nodes}
                        selected_path={stores.ui.selected_folder_path}
                        open_note_path={stores.editor.open_note?.meta.path ??
                          ""}
                        starred_paths={stores.notes.starred_paths}
                        on_toggle_folder={(path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_toggle,
                            path,
                          )}
                        on_select_note={(note_path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.note_open,
                            note_path,
                          )}
                        on_select_folder={(path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.ui_select_folder,
                            path,
                          )}
                        on_request_delete={(note: NoteMeta) =>
                          void action_registry.execute(
                            ACTION_IDS.note_request_delete,
                            note,
                          )}
                        on_request_rename={(note: NoteMeta) =>
                          void action_registry.execute(
                            ACTION_IDS.note_request_rename,
                            note,
                          )}
                        on_request_delete_folder={(folder_path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_request_delete,
                            folder_path,
                          )}
                        on_request_rename_folder={(folder_path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_request_rename,
                            folder_path,
                          )}
                        on_request_create_note={(folder_path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.note_create,
                            folder_path,
                          )}
                        on_request_create_folder={(folder_path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_request_create,
                            folder_path,
                          )}
                        on_toggle_star={toggle_star_for_path}
                        on_retry_load={(path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_retry_load,
                            path,
                          )}
                        on_load_more={(path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_load_more,
                            path,
                          )}
                        on_retry_load_more={(path: string) =>
                          void action_registry.execute(
                            ACTION_IDS.folder_load_more,
                            path,
                          )}
                      />
                    </Sidebar.GroupContent>
                  </Sidebar.Group>
                </Sidebar.Content>

                <Sidebar.Rail />
              </Sidebar.Root>
            </Resizable.Pane>
            <Resizable.Handle withHandle />
          {/if}
          <Resizable.Pane
            order={2}
            defaultSize={stores.ui.sidebar_open ? 80 : 100}
          >
            <Sidebar.Inset class="flex h-full min-h-0 flex-col">
              <header
                class="flex h-12 shrink-0 items-center gap-2 border-b px-4"
              >
                <ContextMenu.Root>
                  <ContextMenu.Trigger class="min-w-0 flex-1">
                    <div
                      class="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium"
                    >
                      <span class="truncate">{open_note_title}</span>
                      {#if stores.editor.open_note?.is_dirty}
                        <Circle class="h-2 w-2 shrink-0 fill-current" />
                      {/if}
                    </div>
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content>
                      <ContextMenu.Item
                        disabled={!stores.editor.open_note}
                        onclick={() =>
                          void action_registry.execute(
                            ACTION_IDS.note_copy_markdown,
                          )}
                      >
                        <Copy class="mr-2 h-4 w-4" />
                        <span>Copy Markdown</span>
                      </ContextMenu.Item>
                      {#if is_persisted_note}
                        <ContextMenu.Separator />
                        <ContextMenu.Item
                          onclick={() => {
                            const note_path =
                              stores.editor.open_note?.meta.path;
                            if (!note_path) {
                              return;
                            }
                            void action_registry.execute(
                              ACTION_IDS.note_toggle_star,
                              note_path,
                            );
                          }}
                        >
                          <Star class="mr-2 h-4 w-4" />
                          <span>
                            {stores.notes.is_starred_path(
                              stores.editor.open_note?.meta.path ?? "",
                            )
                              ? "Unstar"
                              : "Star"}
                          </span>
                        </ContextMenu.Item>
                        <ContextMenu.Separator />
                        <ContextMenu.Item
                          onclick={() =>
                            void action_registry.execute(
                              ACTION_IDS.note_request_rename,
                              stores.editor.open_note?.meta,
                            )}
                        >
                          <Pencil class="mr-2 h-4 w-4" />
                          <span>Rename</span>
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          class="text-destructive"
                          onclick={() =>
                            void action_registry.execute(
                              ACTION_IDS.note_request_delete,
                              stores.editor.open_note?.meta,
                            )}
                        >
                          <Trash2 class="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </ContextMenu.Item>
                      {/if}
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
                <div class="shrink-0">
                  <ThemeToggle
                    mode={stores.ui.theme}
                    on_change={handle_theme_change}
                  />
                </div>
              </header>
              <div class="flex min-h-0 flex-1 flex-col">
                <FindInFileBar
                  open={stores.ui.find_in_file.open}
                  query={stores.ui.find_in_file.query}
                  matches={stores.search.in_file_matches}
                  selected_match_index={stores.ui.find_in_file
                    .selected_match_index}
                  on_query_change={(query: string) =>
                    void action_registry.execute(
                      ACTION_IDS.find_in_file_set_query,
                      query,
                    )}
                  on_next={() =>
                    void action_registry.execute(ACTION_IDS.find_in_file_next)}
                  on_prev={() =>
                    void action_registry.execute(ACTION_IDS.find_in_file_prev)}
                  on_close={() =>
                    void action_registry.execute(ACTION_IDS.find_in_file_close)}
                />
                <NoteEditor />
              </div>
            </Sidebar.Inset>
          </Resizable.Pane>
        </Resizable.PaneGroup>
      </Sidebar.Provider>
    </div>
    <EditorStatusBar
      cursor_info={stores.editor.cursor}
      {word_count}
      has_note={!!stores.editor.open_note}
      index_progress={stores.search.index_progress}
      vault_name={stores.vault.vault?.name ?? null}
      on_vault_click={() =>
        void action_registry.execute(ACTION_IDS.vault_request_change)}
      on_info_click={() => (details_dialog_open = true)}
    />
  </div>

  <NoteDetailsDialog
    open={details_dialog_open}
    note={stores.editor.open_note}
    {word_count}
    line_count={stores.editor.cursor?.total_lines ?? 0}
    on_close={() => (details_dialog_open = false)}
  />
{/if}

<style>
  :global(.SidebarHeaderButton) {
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-default);
  }

  :global(.SidebarHeaderButton:hover) {
    color: var(--foreground);
  }

  :global(.SidebarHeaderIcon) {
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
  }

  :global(.StarredGroupLabel) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-4);
  }

  :global(.StarredGroupLabel__icon) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }
</style>
