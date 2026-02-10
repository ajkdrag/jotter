<script lang="ts">
  import { use_app_context } from "$lib/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/actions/action_ids";
  import type { OpenNoteState } from "$lib/types/editor";

  const { stores, action_registry } = use_app_context();

  const open_note = $derived(stores.editor.open_note);

  function mount_editor(node: HTMLDivElement, note: OpenNoteState) {
    void action_registry.execute(
      ACTION_IDS.app_editor_mount,
      node,
      note,
      stores.ui.editor_settings.link_syntax,
    );

    return {
      destroy() {
        void action_registry.execute(ACTION_IDS.app_editor_unmount);
      },
    };
  }
</script>

<div class="NoteEditor">
  {#if open_note}
    <div use:mount_editor={open_note} class="NoteEditor__content"></div>
  {:else}
    <div class="NoteEditor__empty">
      <p class="text-muted-foreground text-sm">Select a note or create one</p>
    </div>
  {/if}
</div>

<style>
  .NoteEditor {
    overflow-y: auto;
  }

  .NoteEditor__content {
    max-width: 65ch;
    padding: 1.5rem 1.5rem;
  }

  .NoteEditor__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
</style>
