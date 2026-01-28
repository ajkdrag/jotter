<script lang="ts">
    import type { EditorManager } from "$lib/operations/manage_editor";
    import type { OpenNoteState } from "$lib/types/editor";

    interface Props {
        editor_manager: EditorManager;
        open_note: OpenNoteState | null;
        on_markdown_change: (markdown: string) => void;
    }

    let { editor_manager, open_note, on_markdown_change }: Props = $props();

    function mount_editor(node: HTMLDivElement, note: OpenNoteState) {
        void editor_manager.mount(node, note, on_markdown_change);
        return {
            destroy() {
                editor_manager.destroy();
            }
        };
    }
</script>

<div class="NoteEditor">
    {#if open_note}
        {#key open_note.buffer_id}
            <div use:mount_editor={open_note} class="NoteEditor__content"></div>
        {/key}
    {:else}
        <div class="NoteEditor__content"></div>
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
</style>
