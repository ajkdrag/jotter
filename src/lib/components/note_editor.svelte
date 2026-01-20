<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { app_state } from "$lib/adapters/state/app_state.svelte";
    import {
        create_milkdown_editor,
        type MilkdownHandle,
    } from "$lib/adapters/editor/milkdown_adapter";
    import type { OpenNoteState } from "$lib/types/editor";
    import type { NoteMeta } from "$lib/types/note";
    import { as_note_path, as_markdown_text } from "$lib/types/ids";
    import { to_open_note_state } from "$lib/types/editor";

    let editor_root: HTMLDivElement;
    let editor_handle: MilkdownHandle | null = $state(null);
    let current_note_id: string | null = $state(null);
    let cached_untitled: OpenNoteState | null = $state(null);
    let is_initializing = false;

    function generate_untitled_name(): string {
        const existing = app_state.notes
            .map((n) => n.path)
            .filter((path) => /^Untitled-\d+$/.test(path))
            .map((path) => {
                const match = path.match(/^Untitled-(\d+)$/);
                return match && match[1] ? parseInt(match[1], 10) : 0;
            });
        const max = existing.length > 0 ? Math.max(...existing) : 0;
        return `Untitled-${max + 1}`;
    }

    function get_or_create_untitled(): OpenNoteState {
        if (cached_untitled) {
            return cached_untitled;
        }
        const name = generate_untitled_name();
        const meta: NoteMeta = {
            id: as_note_path(name),
            path: as_note_path(name),
            title: name,
            mtime_ms: Date.now(),
            size_bytes: 0,
        };
        cached_untitled = to_open_note_state({
            meta,
            markdown: as_markdown_text(""),
        });
        return cached_untitled;
    }

    function get_current_note(): OpenNoteState | null {
        if (app_state.open_note) {
            cached_untitled = null;
            return app_state.open_note;
        }
        if (app_state.vault) {
            const untitled = get_or_create_untitled();
            app_state.open_note = untitled;
            return untitled;
        }
        cached_untitled = null;
        return null;
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
            // If user navigated away while we were 'awaiting',
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
        if (editor_root && !editor_handle) {
            void initialize_editor();
        }

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
