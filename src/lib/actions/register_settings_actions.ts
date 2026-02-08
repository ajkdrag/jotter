import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import type { EditorSettings } from '$lib/types/editor_settings'

export function register_settings_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input

  registry.register({
    id: ACTION_IDS.settings_open,
    label: 'Open Settings',
    execute: async () => {
      const snapshot = { ...stores.ui.editor_settings }
      stores.ui.settings_dialog = {
        open: true,
        current_settings: snapshot,
        persisted_settings: snapshot,
        has_unsaved_changes: false
      }

      const result = await services.settings.load_settings(stores.ui.editor_settings)
      if (result.status === 'success') {
        stores.ui.settings_dialog = {
          ...stores.ui.settings_dialog,
          current_settings: result.settings,
          persisted_settings: result.settings,
          has_unsaved_changes: false
        }
        stores.ui.set_editor_settings(result.settings)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.settings_close,
    label: 'Close Settings',
    execute: () => {
      const persisted = stores.ui.settings_dialog.persisted_settings
      stores.ui.set_editor_settings(persisted)
      stores.ui.settings_dialog = {
        ...stores.ui.settings_dialog,
        open: false,
        current_settings: persisted,
        has_unsaved_changes: false
      }
      stores.op.reset('settings.load')
      stores.op.reset('settings.save')
    }
  })

  registry.register({
    id: ACTION_IDS.settings_update,
    label: 'Update Settings',
    execute: (settings: unknown) => {
      const editor_settings = settings as EditorSettings
      stores.ui.settings_dialog = {
        ...stores.ui.settings_dialog,
        current_settings: editor_settings,
        has_unsaved_changes: true
      }
      stores.ui.set_editor_settings(editor_settings)
    }
  })

  registry.register({
    id: ACTION_IDS.settings_save,
    label: 'Save Settings',
    execute: async () => {
      const settings = stores.ui.settings_dialog.current_settings
      const result = await services.settings.save_settings(settings)

      if (result.status === 'success') {
        stores.ui.set_editor_settings(settings)
        stores.ui.settings_dialog = {
          ...stores.ui.settings_dialog,
          persisted_settings: settings,
          has_unsaved_changes: false
        }
      }
    }
  })
}
