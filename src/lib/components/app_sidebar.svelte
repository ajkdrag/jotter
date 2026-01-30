<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import * as Resizable from "$lib/components/ui/resizable/index.js";
    import FileTree from "$lib/components/file_tree.svelte";
    import NoteEditor from "$lib/components/note_editor.svelte";
    import ThemeToggle from "$lib/components/theme_toggle.svelte";
    import type { EditorPort } from "$lib/ports/editor_port";
    import { create_editor_manager } from "$lib/operations/manage_editor";
    import type { Vault } from "$lib/types/vault";
    import type { NoteMeta } from "$lib/types/note";
    import type { OpenNoteState } from "$lib/types/editor";
    import { Circle, FilePlus, FolderPlus, RefreshCw, FoldVertical } from "@lucide/svelte";

    type Props = {
        editor_port: EditorPort;
        vault: Vault | null;
        notes: NoteMeta[];
        open_note_title: string;
        open_note: OpenNoteState | null;
        mark_editor_clean_trigger?: number;
        current_theme: 'light' | 'dark' | 'system';
        on_theme_change: (theme: 'light' | 'dark' | 'system') => void;
        on_open_note: (note_path: string) => void;
        on_request_change_vault: () => void;
        on_create_note: () => void;
        on_markdown_change: (markdown: string) => void;
        on_dirty_state_change: (is_dirty: boolean) => void;
        on_request_delete_note?: (note: NoteMeta) => void;
        on_request_rename_note?: (note: NoteMeta) => void;
    };

    let {
        editor_port,
        vault,
        notes,
        open_note_title,
        open_note,
        mark_editor_clean_trigger = 0,
        current_theme,
        on_theme_change,
        on_open_note,
        on_request_change_vault,
        on_create_note,
        on_markdown_change,
        on_dirty_state_change,
        on_request_delete_note,
        on_request_rename_note
    }: Props = $props();

    let open = $state(true);
    const editor_manager = $derived(create_editor_manager(editor_port));

    $effect(() => {
        if (mark_editor_clean_trigger) {
            editor_manager.mark_clean()
        }
    })
</script>

{#if vault}
    <Sidebar.Provider bind:open class="h-screen">
        <Resizable.PaneGroup direction="horizontal" class="h-full">
            {#if open}
            <Resizable.Pane
                defaultSize={15}
                minSize={10}
                maxSize={40}
                order={1}
            >
                <Sidebar.Root collapsible="none" class="w-full">
                    <Sidebar.Header>
                        <div class="flex items-center justify-between w-full px-4 py-2 gap-2">
                            <span class="font-semibold truncate min-w-0">{vault.name}</span>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onclick={on_create_note}
                                    class="text-muted-foreground/70 hover:text-foreground transition-colors"
                                    aria-label="New Note"
                                >
                                    <FilePlus class="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onclick={() => console.log('New Folder triggered')}
                                    class="text-muted-foreground/70 hover:text-foreground transition-colors"
                                    aria-label="New Folder"
                                >
                                    <FolderPlus class="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onclick={() => console.log('Refresh triggered')}
                                    class="text-muted-foreground/70 hover:text-foreground transition-colors"
                                    aria-label="Refresh"
                                >
                                    <RefreshCw class="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onclick={() => console.log('Collapse All triggered')}
                                    class="text-muted-foreground/70 hover:text-foreground transition-colors"
                                    aria-label="Collapse All"
                                >
                                    <FoldVertical class="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </Sidebar.Header>

                                        <Sidebar.Content>
                                                <Sidebar.Group>
                                                        <Sidebar.GroupContent>
                                                                <FileTree
                                                                    notes={notes}
                                                                    on_open_note={on_open_note}
                                                                    on_request_delete={on_request_delete_note}
                                                                    on_request_rename={on_request_rename_note}
                                                                />
                                                        </Sidebar.GroupContent>
                                                </Sidebar.Group>
                                        </Sidebar.Content>

                    <Sidebar.Rail />
                </Sidebar.Root>
            </Resizable.Pane>
            <Resizable.Handle withHandle />
            {/if}
            <Resizable.Pane order={2} defaultSize={open ? 80 : 100}>
                <Sidebar.Inset class="min-h-0 h-full">
                    <header
                        class="flex h-12 shrink-0 items-center gap-2 border-b px-4"
                    >
                        <Sidebar.Trigger />
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
                        />
                    </div>
                </Sidebar.Inset>
            </Resizable.Pane>
        </Resizable.PaneGroup>
    </Sidebar.Provider>
{/if}
