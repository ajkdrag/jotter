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
      app_state.links = { loading: true, backlinks: [], outlinks: [] }
      app_state.conflict = null

      const note_id = doc.meta.id
      void Promise.all([
        ports.index.backlinks(vault.id, note_id),
        ports.index.outlinks(vault.id, note_id)
      ])
        .then(([backlinks, outlinks]) => {
          app_state.links.backlinks = backlinks
          app_state.links.outlinks = outlinks
          app_state.links.loading = false
        })
        .catch(() => {
          app_state.links.loading = false
        })
    }
  }
}
