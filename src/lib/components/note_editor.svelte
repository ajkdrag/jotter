<script lang="ts">
    import type { EditorManager } from "$lib/adapters/editor/editor_manager";
    import type { OpenNoteState } from "$lib/types/editor";
    import type { CursorInfo } from "$lib/ports/editor_port";
    import type { EditorSettings } from "$lib/types/editor_settings";

    interface Props {
        editor_manager: EditorManager;
        open_note: OpenNoteState | null;
        link_syntax: EditorSettings['link_syntax'];
        on_markdown_change: (markdown: string) => void;
        on_dirty_state_change: (is_dirty: boolean) => void;
        on_cursor_change?: (info: CursorInfo) => void;
        on_wiki_link_click?: (note_path: string) => void;
    }

    let { editor_manager, open_note, link_syntax, on_markdown_change, on_dirty_state_change, on_cursor_change, on_wiki_link_click }: Props = $props();

    function mount_editor(node: HTMLDivElement, note: OpenNoteState) {
        const mount_promise = editor_manager.mount(
            node,
            note,
            on_markdown_change,
            on_dirty_state_change,
            link_syntax,
            on_cursor_change,
            on_wiki_link_click
        );

        mount_promise.then(() => {
            editor_manager.focus();
        });

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
