import type { Ports } from '$lib/ports/ports'
import { create_app_stores } from '$lib/stores/create_app_stores'
import { ActionRegistry } from '$lib/actions/registry'
import { register_actions } from '$lib/actions/register_actions'
import type { AppMountConfig } from '$lib/services/vault_service'
import { VaultService } from '$lib/services/vault_service'
import { NoteService } from '$lib/services/note_service'
import { FolderService } from '$lib/services/folder_service'
import { SettingsService } from '$lib/services/settings_service'
import { SearchService } from '$lib/services/search_service'
import { EditorService } from '$lib/services/editor_service'
import { ClipboardService } from '$lib/services/clipboard_service'
import { mount_reactors } from '$lib/reactors'

export type AppContext = ReturnType<typeof create_app_context>

export function create_app_context(input: {
  ports: Ports
  now_ms?: () => number
  default_mount_config: AppMountConfig
}) {
  const now_ms = input.now_ms ?? (() => Date.now())
  const stores = create_app_stores()

  const editor_service = new EditorService(
    input.ports.editor,
    input.ports.assets,
    stores.vault,
    stores.editor
  )

  const settings_service = new SettingsService(
    input.ports.vault_settings,
    stores.vault,
    stores.op
  )

  const note_service = new NoteService(
    input.ports.notes,
    input.ports.index,
    stores.vault,
    stores.notes,
    stores.editor,
    stores.op,
    editor_service,
    now_ms
  )

  const folder_service = new FolderService(
    input.ports.notes,
    input.ports.index,
    stores.vault,
    stores.notes,
    stores.editor,
    stores.op,
    now_ms
  )

  const clipboard_service = new ClipboardService(input.ports.clipboard, stores.editor, stores.op)

  const search_service = new SearchService(input.ports.search, stores.vault, stores.op)

  const vault_service = new VaultService(
    input.ports.vault,
    input.ports.notes,
    input.ports.index,
    input.ports.settings,
    input.ports.vault_settings,
    input.ports.theme,
    stores.vault,
    stores.notes,
    stores.editor,
    stores.op,
    now_ms
  )

  const action_registry = new ActionRegistry()

  register_actions({
    registry: action_registry,
    stores: {
      ui: stores.ui,
      vault: stores.vault,
      notes: stores.notes,
      editor: stores.editor,
      op: stores.op
    },
    services: {
      vault: vault_service,
      note: note_service,
      folder: folder_service,
      settings: settings_service,
      search: search_service,
      editor: editor_service,
      clipboard: clipboard_service
    },
    default_mount_config: input.default_mount_config
  })

  const cleanup_reactors = mount_reactors({
    editor_store: stores.editor,
    ui_store: stores.ui,
    op_store: stores.op,
    editor_service
  })

  return {
    stores,
    ports: input.ports,
    services: {
      editor: editor_service,
      settings: settings_service,
      note: note_service,
      folder: folder_service,
      clipboard: clipboard_service,
      search: search_service,
      vault: vault_service
    },
    action_registry,
    destroy: () => {
      cleanup_reactors()
      editor_service.unmount()
    }
  }
}
