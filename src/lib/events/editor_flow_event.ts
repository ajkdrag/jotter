import type { EditorSettings } from '$lib/types/editor_settings'
import type { OpenNoteState } from '$lib/types/editor'
import type { MarkdownText } from '$lib/types/ids'

export type EditorFlowEvent =
  | {
      type: 'MOUNT_REQUESTED'
      root: HTMLDivElement
      note: OpenNoteState
      link_syntax: EditorSettings['link_syntax']
    }
  | { type: 'UNMOUNT_REQUESTED' }
  | { type: 'OPEN_BUFFER'; note: OpenNoteState; link_syntax: EditorSettings['link_syntax'] }
  | { type: 'APPLY_SETTINGS'; settings: EditorSettings }
  | { type: 'INSERT_TEXT'; text: string }
  | { type: 'MARK_CLEAN' }
  | { type: 'FLUSH_REQUESTED' }
  | { type: 'RUNTIME_MOUNTED' }
  | { type: 'RUNTIME_UNMOUNTED' }
  | { type: 'RUNTIME_FLUSHED'; markdown: MarkdownText }
  | { type: 'RUNTIME_ERROR'; error: string }
