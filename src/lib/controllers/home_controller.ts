import type { VaultId, VaultPath } from '$lib/types/ids'
import { as_markdown_text } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import { create_open_note_workflow } from '$lib/workflows/create_open_note_workflow'
import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
import { create_editor_session_workflow } from '$lib/workflows/create_editor_session_workflow'
import { change_vault } from '$lib/operations/change_vault'
import type { Ports } from '$lib/adapters/create_prod_ports'
import type { AppState } from '$lib/adapters/state/app_state.svelte'

export function create_home_controller(args: {
  ports: Ports
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
    get is_change_vault_dialog_open() {
      return state.is_change_vault_dialog_open
    },
    get recent_vaults() {
      return state.recent_vaults
    },
    async on_open_note(note_path: string) {
      await open_note_workflow.open(note_path)
    },
    on_request_change_vault() {
      state.is_change_vault_dialog_open = true
    },
    on_close_vault_dialog() {
      state.is_change_vault_dialog_open = false
    },
    toggle_change_vault_dialog_state(open_state: boolean) {
      state.is_change_vault_dialog_open = open_state
    },
    async on_choose_vault(onClose?: () => void) {
      const result = await change_vault_workflow.choose_and_change()
      if (result) {
        if (onClose) {
          onClose()
        } else {
          await ports.navigation.navigate_to_home()
        }
      }
    },
    async on_select_vault(vault_id: VaultId, onClose?: () => void) {
      const result = await change_vault_workflow.open_recent(vault_id)
      if (onClose) {
        onClose()
      } else {
        await ports.navigation.navigate_to_home()
      }
    },
    async on_open_last_vault() {
      await change_vault_workflow.open_last_vault()
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
    },
    async bootstrap_default_vault(vault_path: VaultPath) {
      const result = await change_vault(ports, { vault_path })
      state.vault = result.vault
      state.notes = result.notes
      state.open_note = null
      void ports.index.build_index(result.vault.id)
      await change_vault_workflow.load_recent()
    }
  }
}
