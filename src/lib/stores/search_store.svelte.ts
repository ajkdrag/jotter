import type { NoteId } from '$lib/types/ids'
import type { OmnibarItem, InFileMatch } from '$lib/types/search'

export class SearchStore {
  omnibar_items = $state<OmnibarItem[]>([])
  recent_note_ids = $state<NoteId[]>([])
  in_file_matches = $state<InFileMatch[]>([])

  set_omnibar_items(items: OmnibarItem[]) {
    this.omnibar_items = items
  }

  add_recent_note(note_id: NoteId) {
    const filtered = this.recent_note_ids.filter((id) => id !== note_id)
    this.recent_note_ids = [note_id, ...filtered].slice(0, 10)
  }

  set_in_file_matches(matches: InFileMatch[]) {
    this.in_file_matches = matches
  }

  clear_omnibar() {
    this.omnibar_items = []
  }

  clear_in_file_matches() {
    this.in_file_matches = []
  }

  reset() {
    this.omnibar_items = []
    this.recent_note_ids = []
    this.in_file_matches = []
  }
}
