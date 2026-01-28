<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import * as Resizable from "$lib/components/ui/resizable/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import FileTree from "$lib/components/file_tree.svelte";
    import NoteEditor from "$lib/components/note_editor.svelte";
    import type { EditorPort } from "$lib/ports/editor_port";
    import { create_editor_manager } from "$lib/operations/manage_editor";
    import type { Vault } from "$lib/types/vault";
    import type { NoteMeta } from "$lib/types/note";
    import type { OpenNoteState } from "$lib/types/editor";
    import { FolderOpen, ArrowLeftRight, Circle } from "@lucide/svelte";

    type Props = {
        editor_port: EditorPort;
        vault: Vault | null;
        notes: NoteMeta[];
        open_note_title: string;
        open_note: OpenNoteState | null;
        mark_editor_clean_trigger?: number;
        on_open_note: (note_path: string) => void;
        on_request_change_vault: () => void;
        on_markdown_change: (markdown: string) => void;
        on_dirty_state_change: (is_dirty: boolean) => void;
        on_request_delete_note?: (note: NoteMeta) => void;
        on_request_rename_note?: (note: NoteMeta) => void;
        on_register_editor_focus?: (focus: () => void) => void;
    };

    let {
        editor_port,
        vault,
        notes,
        open_note_title,
        open_note,
        mark_editor_clean_trigger = 0,
        on_open_note,
        on_request_change_vault,
        on_markdown_change,
        on_dirty_state_change,
        on_request_delete_note,
        on_request_rename_note,
        on_register_editor_focus
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
                        <Sidebar.Menu>
                            <Sidebar.MenuItem>
                                <Sidebar.MenuButton size="lg">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <FolderOpen class="h-5 w-5 shrink-0" />
                                        <span class="font-semibold truncate"
                                            >{vault.name}</span
                                        >
                                    </div>
                                </Sidebar.MenuButton>
                                <Tooltip.Root>
                                    <Tooltip.Trigger>
                                        {#snippet child({ props })}
                                            <Sidebar.MenuAction
                                                {...props}
                                                showOnHover={true}
                                                onclick={on_request_change_vault}
                                            >
                                                <ArrowLeftRight />
                                            </Sidebar.MenuAction>
                                        {/snippet}
                                    </Tooltip.Trigger>
                                    <Tooltip.Content side="right">
                                        Change Vault
                                    </Tooltip.Content>
                                </Tooltip.Root>
                            </Sidebar.MenuItem>
                        </Sidebar.Menu>
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
                        <div class="text-sm font-medium flex items-center gap-2 min-w-0">
                            <span class="truncate">{open_note_title}</span>
                            {#if open_note?.is_dirty}
                                <Circle class="h-2 w-2 fill-current shrink-0" />
                            {/if}
                        </div>
                    </header>
                    <div class="flex flex-1 flex-col min-h-0">
                        {#if on_register_editor_focus}
                            <NoteEditor
                                editor_manager={editor_manager}
                                open_note={open_note}
                                on_markdown_change={on_markdown_change}
                                on_dirty_state_change={on_dirty_state_change}
                                on_register_focus={on_register_editor_focus}
                            />
                        {:else}
                            <NoteEditor
                                editor_manager={editor_manager}
                                open_note={open_note}
                                on_markdown_change={on_markdown_change}
                                on_dirty_state_change={on_dirty_state_change}
                            />
                        {/if}
                    </div>
                </Sidebar.Inset>
            </Resizable.Pane>
        </Resizable.PaneGroup>
    </Sidebar.Provider>
{/if}
