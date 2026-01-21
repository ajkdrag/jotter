<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import AppSidebar from '$lib/components/app_sidebar.svelte'
  import { create_open_note_workflow } from '$lib/workflows/create_open_note_workflow'
  import { create_editor_session_workflow } from '$lib/workflows/create_editor_session_workflow'
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { change_vault } from '$lib/operations/change_vault'
  import { as_vault_path } from '$lib/types/ids'
  import { ensure_watching } from '$lib/workflows/watcher_session'

  const ports = create_test_ports()
  const open_note_workflow = create_open_note_workflow()
  const editor_session_workflow = create_editor_session_workflow({ state: app_state })

  $effect(() => {
    const _vault = app_state.vault
    const _notes = app_state.notes
    const _open_note = app_state.open_note
    editor_session_workflow.ensure_open_note()
  })

  onMount(async () => {
    if (!app_state.vault) {
      const hardcoded_path = as_vault_path('test-vault')
      const result = await change_vault(ports, { vault_path: hardcoded_path })
      app_state.vault = result.vault
      app_state.notes = result.notes
      app_state.open_note = null
      app_state.search_results = []
      app_state.conflict = null
      await ensure_watching(result.vault.id)
      void ports.index.build_index(result.vault.id)
    }
  })
</script>

{#if app_state.vault}
  <main>
    <AppSidebar onOpenNote={(note_path) => void open_note_workflow.open(note_path)} />
  </main>
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-muted-foreground">Loading test vault...</p>
  </div>
{/if}
