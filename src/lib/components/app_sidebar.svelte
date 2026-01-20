<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import * as Resizable from "$lib/components/ui/resizable/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import FileTree from "$lib/components/file_tree.svelte";
    import NoteEditor from "$lib/components/note_editor.svelte";

    import { app_state } from "$lib/adapters/state/app_state.svelte";
    import { ports } from "$lib/adapters/ports";
    import { FolderOpen, ArrowLeftRight } from "@lucide/svelte";

    let open = $state(true);
    let pane: any = $state();
    let isCurrentlyCollapsed = true;

    function get_current_note_title(): string {
        if (app_state.open_note) {
            return app_state.open_note.meta.title;
        }
        return "Notes";
    }

    $effect(() => {
        if (!pane) return;

        if (open && isCurrentlyCollapsed) {
            pane.expand();
            isCurrentlyCollapsed = false;
        } else if (!open && !isCurrentlyCollapsed) {
            pane.collapse();
            isCurrentlyCollapsed = true;
        }
    });
</script>

{#if app_state.vault}
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
                                            >{app_state.vault.name}</span
                                        >
                                    </div>
                                </Sidebar.MenuButton>
                                <Tooltip.Root>
                                    <Tooltip.Trigger>
                                        {#snippet child({ props })}
                                            <Sidebar.MenuAction
                                                {...props}
                                                showOnHover={true}
                                                onclick={() =>
                                                    ports.navigation.navigate_to_vault_selection()}
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
                                <FileTree notes={app_state.notes} />
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
                        <div class="text-sm font-medium">{get_current_note_title()}</div>
                    </header>
                    <div class="flex flex-1 flex-col min-h-0">
                        <NoteEditor />
                    </div>
                </Sidebar.Inset>
            </Resizable.Pane>
        </Resizable.PaneGroup>
    </Sidebar.Provider>
{/if}
