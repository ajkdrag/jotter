import type { VaultId } from '$lib/types/ids'
import { as_markdown_text } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import { create_open_note_workflow } from '$lib/workflows/create_open_note_workflow'
import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
import { create_editor_session_workflow } from '$lib/workflows/create_editor_session_workflow'
import { ensure_watching } from '$lib/workflows/watcher_session'

type AppState = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
  vault_dialog_open: boolean
}

const window_scheduler = {
  setTimeout: (fn: () => void, delay: number) => window.setTimeout(fn, delay),
  clearTimeout: (id: number | null) => {
    if (id != null) window.clearTimeout(id)
  }
}

export function create_home_host(args: {
  ports: ReturnType<typeof import('$lib/adapters/create_prod_ports').create_prod_ports>
  state: AppState
}) {
  const { ports, state } = args

  const open_note_workflow = create_open_note_workflow({ ports, state })
  const change_vault_workflow = create_change_vault_workflow({ ports, state })
  const editor_session_workflow = create_editor_session_workflow({ state })

  return {
    get vault() {
      return state.vault
    },
    get notes() {
      return state.notes
    },
    get open_note() {
      return state.open_note
    },
    get vault_dialog_open() {
      return state.vault_dialog_open
    },
    get recent_vaults() {
      return state.recent_vaults
    },
    async on_open_note(note_path: string) {
      await open_note_workflow.open(note_path)
      if (state.vault) {
        await ensure_watching(state.vault.id, window_scheduler)
      }
    },
    on_request_change_vault() {
      state.vault_dialog_open = true
    },
    on_close_vault_dialog() {
      state.vault_dialog_open = false
    },
    async on_choose_vault(onClose?: () => void) {
      const result = await change_vault_workflow.choose_and_change()
      if (result) {
        await ensure_watching(result.vault.id, window_scheduler)
        if (onClose) {
          onClose()
        } else {
          await ports.navigation.navigate_to_home()
        }
      }
    },
    async on_select_vault(vault_id: VaultId, onClose?: () => void) {
      const result = await change_vault_workflow.open_recent(vault_id)
      await ensure_watching(result.vault.id, window_scheduler)
      if (onClose) {
        onClose()
      } else {
        await ports.navigation.navigate_to_home()
      }
    },
    async on_open_last_vault() {
      const result = await change_vault_workflow.open_last_vault()
      if (result) {
        await ensure_watching(result.vault.id, window_scheduler)
      }
    },
    on_load_recent() {
      return change_vault_workflow.load_recent()
    },
    ensure_open_note() {
      editor_session_workflow.ensure_open_note()
    },
    on_markdown_change(markdown: string) {
      if (state.open_note) {
        state.open_note.markdown = as_markdown_text(markdown)
      }
    }
  }
}
