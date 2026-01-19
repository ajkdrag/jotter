import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import { suggest_note_path_for_token } from '$lib/utils/wiki_links'

export function create_wiki_link_workflow() {
  return {
    async create_from_token(token: string) {
      const vault = app_state.vault
      if (!vault) throw new Error('no active vault')
      const note_path = suggest_note_path_for_token(token)
      const title = token.split('/').pop() ?? token
      const initial = as_markdown_text(`# ${title}\n\n`)
      const meta = await ports.notes.create_note(vault.id, as_note_path(note_path), initial)
      app_state.notes = await ports.notes.list_notes(vault.id)
      void ports.index.build_index(vault.id)
      return meta
    }
  }
}

