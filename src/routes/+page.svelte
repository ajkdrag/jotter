<script lang="ts">
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import AppSidebar from "$lib/components/app_sidebar.svelte";
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte";
  import { create_open_note_workflow } from "$lib/workflows/create_open_note_workflow";
  import { create_editor_session_workflow } from "$lib/workflows/create_editor_session_workflow";

  const open_note_workflow = create_open_note_workflow();
  const editor_session_workflow = create_editor_session_workflow({ state: app_state });

  $effect(() => {
    const _vault = app_state.vault;
    const _notes = app_state.notes;
    const _open_note = app_state.open_note;
    editor_session_workflow.ensure_open_note();
  });
</script>

{#if !app_state.vault}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel />
  </div>
{:else}
  <main>
    <AppSidebar onOpenNote={(note_path) => void open_note_workflow.open(note_path)} />
  </main>
{/if}


