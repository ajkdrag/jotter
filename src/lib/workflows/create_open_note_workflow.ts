import { to_open_note_state } from '$lib/types/editor'
import { open_note } from '$lib/operations/open_note'
import { as_note_path } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { OpenNoteState } from '$lib/types/editor'

type AppState = {
  vault: Vault | null
  open_note: OpenNoteState | null
}

export function create_open_note_workflow(args: {
  ports: ReturnType<typeof import('$lib/adapters/create_prod_ports').create_prod_ports>
  state: AppState
}) {
  const { ports, state } = args

  return {
    async open(note_path: string) {
      const vault = state.vault
      if (!vault) throw new Error('no active vault')

      const doc = await open_note(
        { notes: ports.notes },
        { vault_id: vault.id, note_id: as_note_path(note_path) }
      )

      state.open_note = to_open_note_state(doc)
    }
  }
}
