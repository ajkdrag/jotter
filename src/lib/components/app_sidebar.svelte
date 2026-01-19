<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import { Button } from "$lib/components/ui/button";
    import FileTree from "$lib/components/file_tree.svelte";

    import { app_state } from "$lib/adapters/state/app_state.svelte";
    import { FolderOpen } from "@lucide/svelte";
</script>

{#if app_state.vault}
    <Sidebar.Provider>
        <Sidebar.Root collapsible="icon">
            <Sidebar.Header>
                <div class="flex items-center gap-2 px-4 py-2">
                    <FolderOpen class="h-5 w-5" />
                    <span class="font-semibold">{app_state.vault.name}</span>
                </div>
            </Sidebar.Header>

            <Sidebar.Content>
                <FileTree notes={app_state.notes} />
            </Sidebar.Content>

            <Sidebar.Footer>
                <Button
                    variant="ghost"
                    class="w-full"
                    onclick={() => console.log("switching vault")}
                >
                    Change Vault
                </Button>
            </Sidebar.Footer>
        </Sidebar.Root>

        <Sidebar.Inset>
            <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <Sidebar.Trigger />
                <div class="text-sm font-medium">Notes</div>
            </header>
            <div
                class="flex flex-1 items-center justify-center text-muted-foreground"
            >
                Select a note to begin
            </div>
        </Sidebar.Inset>
    </Sidebar.Provider>
{/if}
