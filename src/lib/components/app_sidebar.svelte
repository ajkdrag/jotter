<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import * as Resizable from "$lib/components/ui/resizable/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { Button } from "$lib/components/ui/button";
    import ActivityBar from "$lib/components/activity_bar.svelte";
    import VirtualFileTree from "$lib/components/virtual_file_tree.svelte";
    import NoteEditor from "$lib/components/note_editor.svelte";
    import EditorStatusBar from "$lib/components/editor_status_bar.svelte";
    import NoteDetailsDialog from "$lib/components/note_details_dialog.svelte";
    import ThemeToggle from "$lib/components/theme_toggle.svelte";
    import type { EditorManager } from "$lib/operations/manage_editor";
    import type { Vault } from "$lib/types/vault";
    import type { NoteMeta } from "$lib/types/note";
    import type { OpenNoteState } from "$lib/types/editor";
    import type { FolderLoadState } from "$lib/types/filetree";
    import type { CursorInfo } from "$lib/ports/editor_port";
    import { flatten_filetree } from "$lib/utils/flatten_filetree";
    import { count_words } from "$lib/utils/count_words";
    import { Circle, FilePlus, FolderPlus, RefreshCw, FoldVertical } from "@lucide/svelte";

    type Props = {
        editor_manager: EditorManager;
        vault: Vault | null;
        notes: NoteMeta[];
        folder_paths: string[];
        expanded_paths: Set<string>;
        load_states: Map<string, FolderLoadState>;
        open_note_title: string;
        open_note: OpenNoteState | null;
        sidebar_open: boolean;
        selected_folder_path: string;
        current_theme: 'light' | 'dark' | 'system';
        on_theme_change: (theme: 'light' | 'dark' | 'system') => void;
        on_open_note: (note_path: string) => void;
        on_create_note: () => void;
        on_request_create_folder: (parent_path: string) => void;
        on_markdown_change: (markdown: string) => void;
        on_dirty_state_change: (is_dirty: boolean) => void;
        on_request_delete_note?: (note: NoteMeta) => void;
        on_request_rename_note?: (note: NoteMeta) => void;
        on_request_delete_folder?: (folder_path: string) => void;
        on_request_rename_folder?: (folder_path: string) => void;
        on_open_settings: () => void;
        on_toggle_sidebar: () => void;
        on_select_folder_path: (path: string) => void;
        on_toggle_folder: (path: string) => void;
        on_retry_load: (path: string) => void;
        on_collapse_all: () => void;
    };

    let {
        editor_manager,
        vault,
        notes,
        folder_paths,
        expanded_paths,
        load_states,
        open_note_title,
        open_note,
        sidebar_open,
        selected_folder_path,
        current_theme,
        on_theme_change,
        on_open_note,
        on_create_note,
        on_request_create_folder,
        on_markdown_change,
        on_dirty_state_change,
        on_request_delete_note,
        on_request_rename_note,
        on_request_delete_folder,
        on_request_rename_folder,
        on_open_settings,
        on_toggle_sidebar,
        on_select_folder_path,
        on_toggle_folder,
        on_retry_load,
        on_collapse_all
    }: Props = $props();

    const flat_nodes = $derived(flatten_filetree({
        notes,
        folder_paths,
        expanded_paths,
        load_states
    }));

    let cursor_info: CursorInfo | null = $state(null);
    let details_dialog_open = $state(false);

    const word_count = $derived(open_note ? count_words(open_note.markdown) : 0);

    function handle_cursor_change(info: CursorInfo) {
        cursor_info = info;
    }
</script>

{#if vault}
    <div class="flex flex-col h-screen">
        <div class="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <ActivityBar
                sidebar_open={sidebar_open}
                on_toggle_sidebar={on_toggle_sidebar}
                on_open_settings={on_open_settings}
            />
            <Sidebar.Provider open={sidebar_open} class="flex-1 min-h-0">
                <Resizable.PaneGroup direction="horizontal" class="h-full">
                {#if sidebar_open}
                <Resizable.Pane
                    defaultSize={15}
                    minSize={10}
                    maxSize={40}
                    order={1}
                >
                    <Sidebar.Root collapsible="none" class="w-full">
                        <Sidebar.Header>
                            <div class="flex items-center justify-between w-full px-4 py-2 gap-2">
                                <button
                                    type="button"
                                    class="font-semibold truncate min-w-0 text-left hover:text-foreground/90 transition-colors"
                                    onclick={() => on_select_folder_path('')}
                                    aria-label="Select vault root"
                                >
                                    {vault.name}
                                </button>
                                <div class="flex items-center gap-1 shrink-0">
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <Button {...props} variant="ghost" size="icon" class="h-7 w-7" onclick={on_create_note}>
                                                    <FilePlus class="h-4 w-4" />
                                                </Button>
                                            {/snippet}
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>New Note</Tooltip.Content>
                                    </Tooltip.Root>
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <Button {...props} variant="ghost" size="icon" class="h-7 w-7" onclick={() => on_request_create_folder(selected_folder_path)}>
                                                    <FolderPlus class="h-4 w-4" />
                                                </Button>
                                            {/snippet}
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>New Folder</Tooltip.Content>
                                    </Tooltip.Root>
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <Button {...props} variant="ghost" size="icon" class="h-7 w-7" onclick={() => console.log('Refresh triggered')}>
                                                    <RefreshCw class="h-4 w-4" />
                                                </Button>
                                            {/snippet}
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>Refresh</Tooltip.Content>
                                    </Tooltip.Root>
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <Button {...props} variant="ghost" size="icon" class="h-7 w-7" onclick={on_collapse_all}>
                                                    <FoldVertical class="h-4 w-4" />
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
                                        selected_path={selected_folder_path}
                                        open_note_path={open_note?.meta.path ?? ''}
                                        on_toggle_folder={on_toggle_folder}
                                        on_select_note={on_open_note}
                                        on_select_folder={on_select_folder_path}
                                        on_request_delete={on_request_delete_note}
                                        on_request_rename={on_request_rename_note}
                                        on_request_delete_folder={on_request_delete_folder}
                                        on_request_rename_folder={on_request_rename_folder}
                                        on_retry_load={on_retry_load}
                                    />
                                </Sidebar.GroupContent>
                            </Sidebar.Group>
                        </Sidebar.Content>

                        <Sidebar.Rail />
                    </Sidebar.Root>
                </Resizable.Pane>
                <Resizable.Handle withHandle />
                {/if}
                <Resizable.Pane order={2} defaultSize={sidebar_open ? 80 : 100}>
                    <Sidebar.Inset class="min-h-0 h-full flex flex-col">
                        <header
                            class="flex h-12 shrink-0 items-center gap-2 border-b px-4"
                        >
                            <div class="text-sm font-medium flex items-center gap-2 min-w-0 flex-1">
                                <span class="truncate">{open_note_title}</span>
                                {#if open_note?.is_dirty}
                                    <Circle class="h-2 w-2 fill-current shrink-0" />
                                {/if}
                            </div>
                            <div class="shrink-0">
                                <ThemeToggle mode={current_theme} on_change={on_theme_change} />
                            </div>
                        </header>
                        <div class="flex flex-1 flex-col min-h-0">
                            <NoteEditor
                                editor_manager={editor_manager}
                                open_note={open_note}
                                on_markdown_change={on_markdown_change}
                                on_dirty_state_change={on_dirty_state_change}
                                on_cursor_change={handle_cursor_change}
                            />
                        </div>
                    </Sidebar.Inset>
                </Resizable.Pane>
            </Resizable.PaneGroup>
            </Sidebar.Provider>
        </div>
        <EditorStatusBar
            cursor_info={cursor_info}
            word_count={word_count}
            has_note={!!open_note}
            on_info_click={() => details_dialog_open = true}
        />
    </div>

    <NoteDetailsDialog
        open={details_dialog_open}
        note={open_note}
        word_count={word_count}
        line_count={cursor_info?.total_lines ?? 0}
        on_close={() => details_dialog_open = false}
    />
{/if}
