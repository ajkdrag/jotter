<script lang="ts">
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { ports } from '$lib/adapters/ports'
import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
} from '$lib/components/ui/sidebar'
import { Button } from '$lib/components/ui/button'
import FileTree from '$lib/components/file_tree.svelte'
import { FolderOpen } from 'lucide-svelte'

const vault_workflow = create_change_vault_workflow()

let vault_ready = $state(false)

$effect(() => {
  if (!app_state.vault) {
    void ports.navigation.navigate_to_vault_selection()
  } else {
    vault_ready = true
  }
})

async function handle_change_vault() {
  await vault_workflow.choose_and_change()
}
</script>

{#if vault_ready && app_state.vault}
  <SidebarProvider>
    <Sidebar>
      <SidebarHeader>
        <div class="flex items-center gap-2 px-4 py-2">
          <FolderOpen class="h-5 w-5" />
          <span class="font-semibold">{app_state.vault.name}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <FileTree notes={app_state.notes} />
      </SidebarContent>

      <SidebarFooter>
        <Button variant="ghost" class="w-full" onclick={handle_change_vault}>
          Change Vault
        </Button>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset>
      <div class="flex h-full items-center justify-center text-muted-foreground">
        Select a note to begin
      </div>
    </SidebarInset>
  </SidebarProvider>
{/if}
