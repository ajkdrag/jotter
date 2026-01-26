<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import * as Resizable from "$lib/components/ui/resizable/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import FileTree from "$lib/components/file_tree.svelte";
    import NoteEditor from "$lib/components/note_editor.svelte";
    import type { Vault } from "$lib/types/vault";
    import type { NoteMeta } from "$lib/types/note";
    import type { OpenNoteState } from "$lib/types/editor";
    import type { NoteId } from "$lib/types/ids";
    import { FolderOpen, ArrowLeftRight } from "@lucide/svelte";

    type Props = {
        vault: Vault | null;
        notes: NoteMeta[];
        open_note_title: string;
        open_note: OpenNoteState | null;
        on_open_note: (note_path: string) => void;
        on_request_change_vault: () => void;
        on_markdown_change: (markdown: string) => void;
        on_revision_change: (args: { note_id: NoteId; revision_id: number; sticky_dirty: boolean }) => void;
        on_request_delete_note?: (note: NoteMeta) => void;
    };

    let {
        vault,
        notes,
        open_note_title,
        open_note,
        on_open_note,
        on_request_change_vault,
        on_markdown_change,
        on_revision_change,
        on_request_delete_note
    }: Props = $props();

    let open = $state(true);
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
                                {#if on_request_delete_note}
                                  <FileTree notes={notes} on_open_note={on_open_note} on_request_delete={on_request_delete_note} />
                                {:else}
                                  <FileTree notes={notes} on_open_note={on_open_note} />
                                {/if}
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
                            {#if open_note?.dirty}
                                <Badge variant="secondary" class="h-1.5 w-1.5 rounded-full p-0 bg-primary/40 border-none shrink-0" />
                            {/if}
                        </div>
                    </header>
                    <div class="flex flex-1 flex-col min-h-0">
                        <NoteEditor
                            open_note={open_note}
                            on_markdown_change={on_markdown_change}
                            on_revision_change={on_revision_change}
                        />
                    </div>
                </Sidebar.Inset>
            </Resizable.Pane>
        </Resizable.PaneGroup>
    </Sidebar.Provider>
{/if}
