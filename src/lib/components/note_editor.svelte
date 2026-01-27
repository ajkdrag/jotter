<script lang="ts">
    import {
        create_milkdown_editor,
        type MilkdownHandle,
    } from "$lib/adapters/editor/milkdown_adapter";
    import type { OpenNoteState } from "$lib/types/editor";
    import type { NoteId } from "$lib/types/ids";

    interface Props {
        open_note: OpenNoteState | null;
        on_markdown_change: (markdown: string) => void;
        on_revision_change: (args: { note_id: NoteId; revision_id: number; sticky_dirty: boolean }) => void;
    }

    let { open_note, on_markdown_change, on_revision_change }: Props = $props();

    let editor_root: HTMLDivElement;
    let editor_handle: MilkdownHandle | null = $state(null);
    let current_note_id: NoteId | null = $state(null);
    let current_buffer_id: string | null = $state(null);
    let is_initializing = false;

    async function initialize_editor() {
        if (!editor_root || editor_handle || is_initializing) return;

        const note = open_note;
        if (!note) return;

        const expected_note_id = note.meta.id;
        current_note_id = expected_note_id;
        current_buffer_id = note.buffer_id;
        is_initializing = true;
        try {
            const handle = await create_milkdown_editor(editor_root, {
                initial_markdown: note.markdown,
                on_markdown_change: (markdown) => {
                    on_markdown_change(markdown);
                },
                on_revision_change: ({ revision_id, sticky_dirty }) => {
                    const note_id = current_note_id;
                    if (!note_id) return;
                    on_revision_change({ note_id, revision_id, sticky_dirty });
                },
            });
             // If user navigated away while we were awaiting,
             // destroy the instance to prevent a memory leak/ghost editor.

            if (!editor_root) {
                handle.destroy();
                return;
            }
            editor_handle = handle;
            current_note_id = expected_note_id;
            current_buffer_id = note.buffer_id;
        } finally {
            is_initializing = false;
        }
    }

    function update_editor_content(note: OpenNoteState) {
        if (!editor_handle) return;
        if (current_buffer_id === note.buffer_id) {
            current_note_id = note.meta.id;
            return;
        }

        current_buffer_id = note.buffer_id;
        current_note_id = note.meta.id;
        editor_handle.set_markdown(note.markdown);
    }

    $effect(() => {
        if (!editor_root || editor_handle || is_initializing) return;
        if (!open_note) return;
        void initialize_editor();
    });

    $effect(() => {
        return () => {
            if (editor_handle) {
                editor_handle.destroy();
                editor_handle = null;
            }
        };
    });

    $effect(() => {
        const note = open_note;
        if (note && editor_handle && current_note_id !== note.meta.id) {
            update_editor_content(note);
        }
    });
</script>

<div class="NoteEditor">
    <div bind:this={editor_root} class="NoteEditor__content"></div>
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
