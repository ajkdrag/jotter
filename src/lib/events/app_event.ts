import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState, CursorInfo } from '$lib/types/editor'
import type { NoteId, NotePath, MarkdownText } from '$lib/types/ids'
import type { ThemeMode } from '$lib/types/theme'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { FolderContents } from '$lib/types/filetree'

export type AppEvent =
  | { type: 'vault_cleared' }
  | { type: 'vault_set'; vault: Vault }
  | { type: 'recent_vaults_set'; vaults: Vault[] }
  | { type: 'notes_set'; notes: NoteMeta[] }
  | { type: 'note_added'; note: NoteMeta }
  | { type: 'note_removed'; note_id: NoteId }
  | { type: 'note_renamed'; old_path: NotePath; new_path: NotePath }
  | { type: 'folders_set'; folder_paths: string[] }
  | { type: 'folder_added'; folder_path: string }
  | { type: 'folder_removed'; folder_path: string }
  | { type: 'folder_renamed'; old_path: string; new_path: string }
  | { type: 'folder_contents_merged'; folder_path: string; contents: FolderContents }
  | { type: 'open_note_set'; open_note: OpenNoteState }
  | { type: 'open_note_cleared' }
  | { type: 'open_note_markdown_updated'; markdown: MarkdownText }
  | { type: 'open_note_dirty_updated'; is_dirty: boolean }
  | { type: 'open_note_path_updated'; new_path: NotePath }
  | { type: 'open_note_path_prefix_updated'; old_prefix: string; new_prefix: string }
  | { type: 'ui_theme_set'; theme: ThemeMode }
  | { type: 'ui_sidebar_set'; open: boolean }
  | { type: 'ui_selected_folder_set'; path: string }
  | { type: 'ui_editor_settings_set'; settings: EditorSettings }
  | { type: 'ui_system_dialog_set'; open: boolean }
  | { type: 'ui_theme_set_failed'; error: string }
  | { type: 'editor_markdown_changed'; note_id: NoteId; markdown: MarkdownText }
  | { type: 'editor_dirty_changed'; note_id: NoteId; is_dirty: boolean }
  | { type: 'editor_flushed'; note_id: NoteId; markdown: MarkdownText }
  | { type: 'editor_wiki_link_clicked'; note_path: string }
  | { type: 'editor_cursor_changed'; note_id: NoteId; cursor: CursorInfo }
  | { type: 'note_saved'; note_id: NoteId }
  | { type: 'clipboard_write_succeeded' }
  | { type: 'clipboard_write_failed'; error: string }
