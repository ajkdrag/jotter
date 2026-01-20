<script lang="ts">
    import { app_state } from "$lib/adapters/state/app_state.svelte";
    import {
        create_milkdown_editor,
        type MilkdownHandle,
    } from "$lib/adapters/editor/milkdown_adapter";
    import { as_markdown_text } from "$lib/types/ids";
    import type { OpenNoteState } from "$lib/types/editor";

    let editor_root: HTMLDivElement;
    let editor_handle: MilkdownHandle | null = $state(null);
    let current_note_id: string | null = $state(null);
    let is_initializing = false;

    function get_current_note() {
        return app_state.open_note;
    }

    async function initialize_editor() {
        if (!editor_root || editor_handle || is_initializing) return;

        const note = get_current_note();
        if (!note) return;
        is_initializing = true;
        try {
            const handle = await create_milkdown_editor(editor_root, {
                initial_markdown: note.markdown,
                on_markdown_change: (markdown) => {
                    const current = app_state.open_note;
                    if (current) current.markdown = as_markdown_text(markdown);
                },
            });
             // If user navigated away while we were awaiting,
             // destroy the instance to prevent a memory leak/ghost editor.

            if (!editor_root) {
                handle.destroy();
                return;
            }
            editor_handle = handle;
            current_note_id = note.meta.id;
        } finally {
            is_initializing = false;
        }
    }

    function update_editor_content(note: OpenNoteState) {
        if (!editor_handle) return;
        if (current_note_id === note.meta.id) return;

        editor_handle.set_markdown(note.markdown);
        current_note_id = note.meta.id;
    }

    $effect(() => {
        if (!editor_root || editor_handle || is_initializing) return;
        if (!app_state.open_note) return;
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
        const note = get_current_note();
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
