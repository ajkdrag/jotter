import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { OpenNoteState } from '$lib/types/editor'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

export function register_app_actions(input: ActionRegistrationInput) {
  const { registry, stores, services, default_mount_config } = input

  registry.register({
    id: ACTION_IDS.app_mounted,
    label: 'App Mounted',
    execute: async () => {
      stores.ui.startup = {
        status: 'loading',
        error: null
      }

      const result = await services.vault.initialize(default_mount_config)
      stores.ui.set_theme(result.theme)

      if (result.status === 'error') {
        stores.ui.startup = {
          status: 'error',
          error: result.error
        }
        return
      }

      if (default_mount_config.reset_app_state) {
        stores.ui.reset_for_new_vault()
        stores.ui.set_editor_settings({ ...DEFAULT_EDITOR_SETTINGS })
      }

      if (result.has_vault) {
        stores.ui.reset_for_new_vault()
        stores.ui.set_editor_settings(result.editor_settings ?? { ...DEFAULT_EDITOR_SETTINGS })
        await registry.execute(ACTION_IDS.folder_refresh_tree)
      }

      stores.ui.startup = {
        status: 'idle',
        error: null
      }
    }
  })

  registry.register({
    id: ACTION_IDS.app_editor_mount,
    label: 'Editor Mount',
    execute: async (
      root: unknown,
      note: unknown,
      link_syntax: unknown,
      on_wiki_link_click: unknown
    ) => {
      await services.editor.mount({
        root: root as HTMLDivElement,
        note: note as OpenNoteState,
        link_syntax: link_syntax as EditorSettings['link_syntax'],
        on_wiki_link_click: on_wiki_link_click as (note_path: string) => void
      })
    }
  })

  registry.register({
    id: ACTION_IDS.app_editor_unmount,
    label: 'Editor Unmount',
    execute: () => {
      services.editor.unmount()
    }
  })
}
