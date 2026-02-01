import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { VaultId, VaultPath, NoteId, NotePath } from '$lib/types/ids'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

export function create_test_vault(overrides?: Partial<Vault>): Vault {
  return {
    id: 'vault-1' as VaultId,
    name: 'Test Vault',
    path: '/test/vault' as VaultPath,
    created_at: 0,
    ...overrides
  }
}

export function create_test_note(id: string, title: string): NoteMeta {
  return {
    id: id as NoteId,
    path: `${id}.md` as NotePath,
    title,
    mtime_ms: 0,
    size_bytes: 0
  }
}

export function create_open_note_state(note: NoteMeta, markdown = 'content'): OpenNoteState {
  return {
    meta: note,
    markdown: as_markdown_text(markdown),
    buffer_id: note.id,
    is_dirty: false
  }
}

export function create_untitled_note_state(title: string): OpenNoteState {
  return {
    meta: {
      id: as_note_path(title),
      path: as_note_path(title),
      title,
      mtime_ms: 0,
      size_bytes: 0
    },
    markdown: as_markdown_text('untitled content'),
    buffer_id: `untitled-test:${title}`,
    is_dirty: false
  }
}
