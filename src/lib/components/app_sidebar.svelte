<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar/index.js'
  import * as Resizable from '$lib/components/ui/resizable/index.js'
  import * as Tooltip from '$lib/components/ui/tooltip/index.js'
  import * as ContextMenu from '$lib/components/ui/context-menu'
  import { Button } from '$lib/components/ui/button'
  import ActivityBar from '$lib/components/activity_bar.svelte'
  import VirtualFileTree from '$lib/components/virtual_file_tree.svelte'
  import NoteEditor from '$lib/components/note_editor.svelte'
  import EditorStatusBar from '$lib/components/editor_status_bar.svelte'
  import NoteDetailsDialog from '$lib/components/note_details_dialog.svelte'
  import ThemeToggle from '$lib/components/theme_toggle.svelte'
  import { flatten_filetree } from '$lib/utils/flatten_filetree'
  import { count_words } from '$lib/utils/count_words'
  import { use_app_context } from '$lib/context/app_context.svelte'
  import { ACTION_IDS } from '$lib/actions/action_ids'
  import type { NoteMeta } from '$lib/types/note'
  import { Circle, FilePlus, FolderPlus, RefreshCw, FoldVertical, Copy } from '@lucide/svelte'

  const { stores, action_registry } = use_app_context()

  const flat_nodes = $derived(
    flatten_filetree({
      notes: stores.notes.notes,
      folder_paths: stores.notes.folder_paths,
      expanded_paths: stores.ui.filetree.expanded_paths,
      load_states: stores.ui.filetree.load_states,
      error_messages: stores.ui.filetree.error_messages
    })
  )

  const open_note_title = $derived(stores.editor.open_note?.meta.title ?? 'Notes')
  const word_count = $derived(stores.editor.open_note ? count_words(stores.editor.open_note.markdown) : 0)

  let details_dialog_open = $state(false)

  function handle_theme_change(theme: 'light' | 'dark' | 'system') {
    void action_registry.execute(ACTION_IDS.ui_set_theme, theme)
  }
</script>

{#if stores.vault.vault}
  <div class="flex h-screen flex-col">
    <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <ActivityBar
        sidebar_open={stores.ui.sidebar_open}
        on_toggle_sidebar={() => void action_registry.execute(ACTION_IDS.ui_toggle_sidebar)}
        on_open_settings={() => void action_registry.execute(ACTION_IDS.settings_open)}
      />
      <Sidebar.Provider open={stores.ui.sidebar_open} class="flex-1 min-h-0">
        <Resizable.PaneGroup direction="horizontal" class="h-full">
          {#if stores.ui.sidebar_open}
            <Resizable.Pane defaultSize={15} minSize={10} maxSize={40} order={1}>
              <Sidebar.Root collapsible="none" class="w-full">
                <Sidebar.Header>
                  <div class="flex w-full items-center justify-between gap-2 px-4 py-2">
                    <button
                      type="button"
                      class="min-w-0 truncate text-left font-semibold transition-colors hover:text-foreground/90"
                      onclick={() => {
                        void action_registry.execute(ACTION_IDS.ui_select_folder, '')
                      }}
                      aria-label="Select vault root"
                    >
                      {stores.vault.vault.name}
                    </button>
                    <div class="flex shrink-0 items-center">
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon"
                              class="SidebarHeaderButton h-7 w-7"
                              onclick={() => void action_registry.execute(ACTION_IDS.note_create)}
                            >
                              <FilePlus class="SidebarHeaderIcon" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>New Note</Tooltip.Content>
                      </Tooltip.Root>
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon"
                              class="SidebarHeaderButton h-7 w-7"
                              onclick={() => {
                                void action_registry.execute(
                                  ACTION_IDS.folder_request_create,
                                  stores.ui.selected_folder_path
                                )
                              }}
                            >
                              <FolderPlus class="SidebarHeaderIcon" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>New Folder</Tooltip.Content>
                      </Tooltip.Root>
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon"
                              class="SidebarHeaderButton h-7 w-7"
                              onclick={() => void action_registry.execute(ACTION_IDS.folder_refresh_tree)}
                            >
                              <RefreshCw class="SidebarHeaderIcon" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Refresh</Tooltip.Content>
                      </Tooltip.Root>
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              variant="ghost"
                              size="icon"
                              class="SidebarHeaderButton h-7 w-7"
                              onclick={() => void action_registry.execute(ACTION_IDS.folder_collapse_all)}
                            >
                              <FoldVertical class="SidebarHeaderIcon" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Collapse All</Tooltip.Content>
                      </Tooltip.Root>
                    </div>
                  </div>
                </Sidebar.Header>

                <Sidebar.Content class="overflow-hidden">
                  <Sidebar.Group class="h-full">
                    <Sidebar.GroupContent class="h-full">
                      <VirtualFileTree
                        nodes={flat_nodes}
                        selected_path={stores.ui.selected_folder_path}
                        open_note_path={stores.editor.open_note?.meta.path ?? ''}
                        on_toggle_folder={(path: string) =>
                          void action_registry.execute(ACTION_IDS.folder_toggle, path)}
                        on_select_note={(note_path: string) =>
                          void action_registry.execute(ACTION_IDS.note_open, note_path)}
                        on_select_folder={(path: string) =>
                          void action_registry.execute(ACTION_IDS.ui_select_folder, path)}
                        on_request_delete={(note: NoteMeta) =>
                          void action_registry.execute(ACTION_IDS.note_request_delete, note)}
                        on_request_rename={(note: NoteMeta) =>
                          void action_registry.execute(ACTION_IDS.note_request_rename, note)}
                        on_request_delete_folder={(folder_path: string) =>
                          void action_registry.execute(ACTION_IDS.folder_request_delete, folder_path)}
                        on_request_rename_folder={(folder_path: string) =>
                          void action_registry.execute(ACTION_IDS.folder_request_rename, folder_path)}
                        on_retry_load={(path: string) =>
                          void action_registry.execute(ACTION_IDS.folder_retry_load, path)}
                      />
                    </Sidebar.GroupContent>
                  </Sidebar.Group>
                </Sidebar.Content>

                <Sidebar.Rail />
              </Sidebar.Root>
            </Resizable.Pane>
            <Resizable.Handle withHandle />
          {/if}
          <Resizable.Pane order={2} defaultSize={stores.ui.sidebar_open ? 80 : 100}>
            <Sidebar.Inset class="flex h-full min-h-0 flex-col">
              <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <ContextMenu.Root>
                  <ContextMenu.Trigger class="min-w-0 flex-1">
                    <div class="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
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
                        onclick={() => void action_registry.execute(ACTION_IDS.note_copy_markdown)}
                      >
                        <Copy class="mr-2 h-4 w-4" />
                        <span>Copy Markdown</span>
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
                <div class="shrink-0">
                  <ThemeToggle mode={stores.ui.theme} on_change={handle_theme_change} />
                </div>
              </header>
              <div class="flex min-h-0 flex-1 flex-col">
                <NoteEditor />
              </div>
            </Sidebar.Inset>
          </Resizable.Pane>
        </Resizable.PaneGroup>
      </Sidebar.Provider>
    </div>
    <EditorStatusBar
      cursor_info={stores.editor.cursor}
      word_count={word_count}
      has_note={!!stores.editor.open_note}
      on_info_click={() => (details_dialog_open = true)}
    />
  </div>

  <NoteDetailsDialog
    open={details_dialog_open}
    note={stores.editor.open_note}
    word_count={word_count}
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
</style>
