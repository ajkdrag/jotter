import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { NoteService } from '$lib/services/note_service'

const AUTOSAVE_DELAY_MS = 2000

export function create_autosave_reactor(
  editor_store: EditorStore,
  note_service: NoteService
): () => void {
  return $effect.root(() => {
    $effect(() => {
      const open_note = editor_store.open_note
      if (!open_note?.is_dirty) return
      if (!open_note.meta.path.endsWith('.md')) return

      const handle = setTimeout(() => {
        void note_service.save_note(null, true)
      }, AUTOSAVE_DELAY_MS)

      return () => { clearTimeout(handle) }
    })
  })
}
