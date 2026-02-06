import type { EventBus } from '$lib/events/event_bus'
import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'
import type { EditorFlowContext, EditorFlowEvents } from '$lib/flows/editor_flow'
import type { OpenNoteFlowContext, OpenNoteFlowEvents } from '$lib/flows/open_note_flow'
import type { FiletreeFlowContext, FiletreeFlowEvents } from '$lib/flows/filetree_flow'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { Vault } from '$lib/types/vault'
import type { OpenNoteState } from '$lib/types/editor'
import { apply_editor_styles } from '$lib/shell/apply_editor_styles'
import { as_note_path } from '$lib/types/ids'
import { toast } from 'svelte-sonner'
import { logger } from '$lib/utils/logger'

type EditorFlowHandle = FlowHandle<EditorFlowEvents, FlowSnapshot<EditorFlowContext>>
type OpenNoteFlowHandle = FlowHandle<OpenNoteFlowEvents, FlowSnapshot<OpenNoteFlowContext>>
type FiletreeFlowHandle = FlowHandle<FiletreeFlowEvents, FlowSnapshot<FiletreeFlowContext>>

export type ShellReactionReaders = {
  get_link_syntax: () => EditorSettings['link_syntax']
  get_vault: () => Vault | null
  get_open_note: () => OpenNoteState | null
}

export function attach_shell_reactions(input: {
  event_bus: EventBus
  editor_flow: EditorFlowHandle
  open_note_flow: OpenNoteFlowHandle
  filetree_flow: FiletreeFlowHandle
  readers: ShellReactionReaders
}): () => void {
  const { event_bus, editor_flow, open_note_flow, filetree_flow, readers } = input

  return event_bus.subscribe((event) => {
    switch (event.type) {
      case 'open_note_set':
        editor_flow.send({
          type: 'OPEN_BUFFER',
          note: event.open_note,
          link_syntax: readers.get_link_syntax()
        })
        break
      case 'ui_editor_settings_set':
        apply_editor_styles(event.settings)
        editor_flow.send({ type: 'APPLY_SETTINGS', settings: event.settings })
        break
      case 'ui_theme_set_failed':
        logger.from_error('Theme update failed', event.error)
        toast.error('Failed to update theme')
        break
      case 'note_saved':
        editor_flow.send({ type: 'MARK_CLEAN' })
        break
      case 'clipboard_write_succeeded':
        toast.success('Copied to clipboard')
        break
      case 'clipboard_write_failed':
        logger.from_error('Clipboard write failed', event.error)
        toast.error('Failed to copy to clipboard')
        break
      case 'editor_wiki_link_clicked': {
        const vault = readers.get_vault()
        if (!vault) break
        const normalized = as_note_path(event.note_path)
        const current_note_id = readers.get_open_note()?.meta.id
        if (current_note_id && current_note_id === normalized) break
        open_note_flow.send({ type: 'OPEN_WIKI_LINK', vault_id: vault.id, note_path: normalized })
        break
      }
      case 'vault_set':
        filetree_flow.send({ type: 'VAULT_CHANGED' })
        break
      default:
        break
    }
  })
}
