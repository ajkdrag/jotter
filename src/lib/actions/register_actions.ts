import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import { register_app_actions } from '$lib/actions/register_app_actions'
import { register_note_actions } from '$lib/actions/register_note_actions'
import { register_folder_actions } from '$lib/actions/register_folder_actions'
import { register_vault_actions } from '$lib/actions/register_vault_actions'
import { register_settings_actions } from '$lib/actions/register_settings_actions'
import { register_search_actions } from '$lib/actions/register_search_actions'
import { register_ui_actions } from '$lib/actions/register_ui_actions'

export function register_actions(input: ActionRegistrationInput) {
  register_app_actions(input)
  register_note_actions(input)
  register_folder_actions(input)
  register_vault_actions(input)
  register_settings_actions(input)
  register_search_actions(input)
  register_ui_actions(input)
}
