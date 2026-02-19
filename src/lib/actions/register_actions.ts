import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { register_app_actions } from "$lib/actions/register_app_actions";
import { register_note_actions } from "$lib/actions/register_note_actions";
import { register_folder_actions } from "$lib/actions/register_folder_actions";
import { register_vault_actions } from "$lib/actions/register_vault_actions";
import { register_settings_actions } from "$lib/actions/register_settings_actions";
import { register_omnibar_actions } from "$lib/actions/register_omnibar_actions";
import { register_ui_actions } from "$lib/actions/register_ui_actions";
import { register_find_in_file_actions } from "$lib/actions/register_find_in_file_actions";
import { register_tab_actions } from "$lib/actions/register_tab_actions";
import { register_git_actions } from "$lib/actions/register_git_actions";
import { register_hotkey_actions } from "$lib/actions/register_hotkey_actions";
import { register_help_actions } from "$lib/actions/register_help_actions";

export function register_actions(input: ActionRegistrationInput) {
  register_app_actions(input);
  register_note_actions(input);
  register_folder_actions(input);
  register_vault_actions(input);
  register_settings_actions(input);
  register_omnibar_actions(input);
  register_ui_actions(input);
  register_find_in_file_actions(input);
  register_tab_actions(input);
  register_git_actions(input);
  register_hotkey_actions(input);
  register_help_actions(input);
}
