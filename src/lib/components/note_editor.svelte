<script lang="ts">
    import type { OpenNoteState } from "$lib/types/editor";

    interface Props {
        open_note: OpenNoteState | null;
        on_mount: (root: HTMLDivElement, note: OpenNoteState) => void;
        on_unmount: () => void;
    }

    let { open_note, on_mount, on_unmount }: Props = $props();

    function mount_editor(node: HTMLDivElement, note: OpenNoteState) {
        on_mount(node, note);

        return {
            destroy() {
                on_unmount();
            }
        };
    }
</script>

<div class="NoteEditor">
    {#if open_note}
        <div use:mount_editor={open_note} class="NoteEditor__content"></div>
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
