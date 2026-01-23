<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_home_controller } from '$lib/controllers/home_controller'
  import { reset_app_state_for_backend_switch } from '$lib/utils/reset_app_state_for_backend_switch'
  import { as_vault_path } from '$lib/types/ids'

  let controller: ReturnType<typeof create_home_controller> | undefined = $state()

  onMount(async () => {
    reset_app_state_for_backend_switch(app_state)
    const ports = create_test_ports()
    controller = create_home_controller({ ports, state: app_state })
    if (!app_state.vault) {
      const hardcoded_path = as_vault_path('test-vault')
      await controller.bootstrap_default_vault(hardcoded_path)
    }
  })

  $effect(() => {
    if (controller) {
      const _vault = controller.vault
      const _notes = controller.notes
      const _open_note = controller.open_note
      controller.ensure_open_note()
    }
  })
</script>

{#if controller}
  {@const c = controller}
  {#if c.vault}
    <main>
      <AppSidebar
        vault={c.vault}
        notes={c.notes}
        open_note_title={c.open_note?.meta.title ?? "Notes"}
        is_vault_dialog_open={c.is_change_vault_dialog_open}
        open_note={c.open_note}
        onOpenNote={(note_path) => void c.on_open_note(note_path)}
        onRequestChangeVault={c.on_request_change_vault}
        onMarkdownChange={c.on_markdown_change}
      />
    </main>
  {:else}
    <div class="flex items-center justify-center min-h-screen">
      <p class="text-muted-foreground">Loading test vault...</p>
    </div>
  {/if}
{/if}
