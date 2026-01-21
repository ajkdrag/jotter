import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { to_open_note_state } from '$lib/types/editor'
import { open_note } from '$lib/operations/open_note'
import { as_note_path } from '$lib/types/ids'
import { ensure_watching } from '$lib/workflows/watcher_session'

export function create_open_note_workflow() {
  return {
    async open(note_path: string) {
      const vault = app_state.vault
      if (!vault) throw new Error('no active vault')

      await ensure_watching(vault.id)

      const doc = await open_note(
        { notes: ports.notes },
        { vault_id: vault.id, note_id: as_note_path(note_path) }
      )

      app_state.open_note = to_open_note_state(doc)
    }
  }
}
