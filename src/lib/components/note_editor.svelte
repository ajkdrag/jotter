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
            return get_or_create_untitled();
        }
        cached_untitled = null;
        return null;
    }

    async function initialize_editor() {
        if (!editor_root) return;

        const note = get_current_note();
        if (!note) return;

        const handle = await create_milkdown_editor(editor_root, {
            initial_markdown: note.markdown,
            on_markdown_change: (markdown) => {
                const current = app_state.open_note;
                if (current) {
                    current.markdown = as_markdown_text(markdown);
                }
            },
        });

        editor_handle = handle;
        current_note_id = note.meta.id;
    }

    function update_editor_content(note: OpenNoteState) {
        if (!editor_handle) return;
        if (current_note_id === note.meta.id) return;

        editor_handle.set_markdown(note.markdown);
        current_note_id = note.meta.id;
    }

    $effect(() => {
        const note = get_current_note();
        if (!note) {
            if (editor_handle) {
                editor_handle.destroy();
                editor_handle = null;
                current_note_id = null;
            }
            return;
        }

        if (!editor_handle) {
            void initialize_editor();
            return;
        }

        if (current_note_id !== note.meta.id) {
            update_editor_content(note);
        }
    });

    onMount(() => {
        if (editor_root && !editor_handle) {
            void initialize_editor();
        }
    });

    onDestroy(() => {
        if (editor_handle) {
            editor_handle.destroy();
            editor_handle = null;
        }
    });
</script>

<div
    bind:this={editor_root}
    class="milkdown-editor h-full w-full overflow-y-auto"
></div>

<style>
    /* This ensures the actual Prosemirror editor fills the container */
    :global(.milkdown .editor) {
        height: 100%;
        min-height: 100%;
        outline: none;
        padding-bottom: 20rem; /* Give some breathing room at the bottom */
    }
    /* This prevents the theme's background/mask from leaking out */
    .milkdown-editor {
        position: relative;
        isolation: isolate;
    }
</style>
