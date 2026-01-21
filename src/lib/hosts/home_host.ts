import type { VaultId } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import { create_open_note_workflow } from '$lib/workflows/create_open_note_workflow'
import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
import { create_editor_session_workflow } from '$lib/workflows/create_editor_session_workflow'

type AppState = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
  vault_dialog_open: boolean
}

export function create_home_host(args: {
  ports: ReturnType<typeof import('$lib/adapters/create_prod_ports').create_prod_ports>
  state: AppState
}) {
  const { state } = args

  const open_note_workflow = create_open_note_workflow()
  const change_vault_workflow = create_change_vault_workflow()
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
    on_open_note(note_path: string) {
      return open_note_workflow.open(note_path)
    },
    on_request_change_vault() {
      state.vault_dialog_open = true
    },
    on_close_vault_dialog() {
      state.vault_dialog_open = false
    },
    on_choose_vault(onClose?: () => void) {
      return change_vault_workflow.choose_and_change(onClose)
    },
    on_select_vault(vault_id: VaultId, onClose?: () => void) {
      return change_vault_workflow.open_recent(vault_id, onClose)
    },
    on_load_recent() {
      return change_vault_workflow.load_recent()
    },
    ensure_open_note() {
      editor_session_workflow.ensure_open_note()
    }
  }
}
