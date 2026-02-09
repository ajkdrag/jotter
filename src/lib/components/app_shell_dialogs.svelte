<script lang="ts">
  import VaultDialog from "$lib/components/vault_dialog.svelte";
  import DeleteNoteDialog from "$lib/components/delete_note_dialog.svelte";
  import RenameNoteDialog from "$lib/components/rename_note_dialog.svelte";
  import DeleteFolderDialog from "$lib/components/delete_folder_dialog.svelte";
  import RenameFolderDialog from "$lib/components/rename_folder_dialog.svelte";
  import SaveNoteDialog from "$lib/components/save_note_dialog.svelte";
  import SettingsDialog from "$lib/components/settings_dialog.svelte";
  import CreateFolderDialog from "$lib/components/create_folder_dialog.svelte";
  import Omnibar from "$lib/components/omnibar.svelte";
  import ImagePasteDialog from "$lib/components/image_paste_dialog.svelte";
  import { use_app_context } from "$lib/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/actions/action_ids";
  import type { OmnibarItem } from "$lib/types/search";
  import type { EditorSettings } from "$lib/types/editor_settings";
  import type { VaultId } from "$lib/types/ids";

  type Props = {
    hide_choose_vault_button?: boolean;
  };

  let { hide_choose_vault_button = false }: Props = $props();

  const { stores, action_registry } = use_app_context();

  const has_vault = $derived(stores.vault.vault !== null);

  const recent_notes_for_display = $derived(
    stores.search.recent_note_ids
      .map((id) => stores.notes.notes.find((note) => note.id === id))
      .filter((note): note is NonNullable<typeof note> => note != null),
  );

  const delete_note_error = $derived(stores.op.get("note.delete").error);
  const rename_note_error = $derived(stores.op.get("note.rename").error);
  const save_note_error = $derived(stores.op.get("note.save").error);
  const create_folder_error = $derived(stores.op.get("folder.create").error);
  const delete_folder_error = $derived(stores.op.get("folder.delete").error);
  const rename_folder_error = $derived(stores.op.get("folder.rename").error);
  const settings_error = $derived(
    stores.op.get("settings.save").error ??
      stores.op.get("settings.load").error,
  );
  const image_paste_error = $derived(stores.op.get("asset.write").error);

  const delete_folder_status = $derived.by(() => {
    const op_state = stores.op.get("folder.delete").status;
    if (op_state === "pending") return "deleting";
    if (op_state === "error") return "error";
    return stores.ui.delete_folder_dialog.status;
  });

  const rename_folder_status = $derived.by(() => {
    const op_state = stores.op.get("folder.rename").status;
    if (op_state === "pending") return "renaming";
    if (op_state === "error") return "error";
    if (stores.ui.rename_folder_dialog.open) return "confirming";
    return "idle";
  });
</script>

{#if has_vault}
  <VaultDialog
    open={stores.ui.change_vault.open}
    on_open_change={(open) => {
      if (!open) {
        void action_registry.execute(ACTION_IDS.vault_close_change);
      }
    }}
    recent_vaults={stores.vault.recent_vaults}
    current_vault_id={stores.vault.vault?.id ?? null}
    is_loading={stores.ui.change_vault.is_loading}
    error={stores.ui.change_vault.error}
    on_choose_vault_dir={() =>
      void action_registry.execute(ACTION_IDS.vault_choose)}
    on_select_vault={(vault_id: VaultId) =>
      void action_registry.execute(ACTION_IDS.vault_select, vault_id)}
    {hide_choose_vault_button}
  />
{/if}

<DeleteNoteDialog
  open={stores.ui.delete_note_dialog.open}
  note={stores.ui.delete_note_dialog.note}
  is_deleting={stores.op.is_pending("note.delete")}
  error={delete_note_error}
  on_confirm={() =>
    void action_registry.execute(ACTION_IDS.note_confirm_delete)}
  on_cancel={() => void action_registry.execute(ACTION_IDS.note_cancel_delete)}
  on_retry={() => void action_registry.execute(ACTION_IDS.note_confirm_delete)}
/>

<RenameNoteDialog
  open={stores.ui.rename_note_dialog.open}
  note={stores.ui.rename_note_dialog.note}
  new_name={stores.ui.rename_note_dialog.new_name}
  is_renaming={stores.op.is_pending("note.rename")}
  is_checking_conflict={stores.ui.rename_note_dialog.is_checking_conflict}
  error={rename_note_error}
  show_overwrite_confirm={stores.ui.rename_note_dialog.show_overwrite_confirm}
  on_update_name={(name: string) =>
    void action_registry.execute(ACTION_IDS.note_rename, name)}
  on_confirm={() =>
    void action_registry.execute(ACTION_IDS.note_confirm_rename)}
  on_confirm_overwrite={() =>
    void action_registry.execute(ACTION_IDS.note_confirm_rename_overwrite)}
  on_cancel={() => void action_registry.execute(ACTION_IDS.note_cancel_rename)}
  on_retry={() => void action_registry.execute(ACTION_IDS.note_retry_rename)}
/>

<DeleteFolderDialog
  open={stores.ui.delete_folder_dialog.open}
  folder_path={stores.ui.delete_folder_dialog.folder_path}
  affected_note_count={stores.ui.delete_folder_dialog.affected_note_count}
  affected_folder_count={stores.ui.delete_folder_dialog.affected_folder_count}
  status={delete_folder_status}
  error={delete_folder_error}
  on_confirm={() =>
    void action_registry.execute(ACTION_IDS.folder_confirm_delete)}
  on_cancel={() =>
    void action_registry.execute(ACTION_IDS.folder_cancel_delete)}
  on_retry={() => void action_registry.execute(ACTION_IDS.folder_retry_delete)}
/>

<RenameFolderDialog
  open={stores.ui.rename_folder_dialog.open}
  folder_path={stores.ui.rename_folder_dialog.folder_path}
  new_name={stores.ui.rename_folder_dialog.new_name}
  status={rename_folder_status}
  error={rename_folder_error}
  on_update_name={(name: string) =>
    void action_registry.execute(ACTION_IDS.folder_rename, name)}
  on_confirm={() =>
    void action_registry.execute(ACTION_IDS.folder_confirm_rename)}
  on_cancel={() =>
    void action_registry.execute(ACTION_IDS.folder_cancel_rename)}
  on_retry={() => void action_registry.execute(ACTION_IDS.folder_retry_rename)}
/>

<SaveNoteDialog
  open={stores.ui.save_note_dialog.open}
  new_path={stores.ui.save_note_dialog.new_path}
  folder_path={stores.ui.save_note_dialog.folder_path}
  is_saving={stores.op.is_pending("note.save")}
  is_checking={stores.ui.save_note_dialog.is_checking_existence}
  show_overwrite_confirm={stores.ui.save_note_dialog.show_overwrite_confirm}
  error={save_note_error}
  on_update_path={(path: string) =>
    void action_registry.execute(ACTION_IDS.note_update_save_path, path)}
  on_confirm={() => void action_registry.execute(ACTION_IDS.note_confirm_save)}
  on_confirm_overwrite={() =>
    void action_registry.execute(ACTION_IDS.note_confirm_save_overwrite)}
  on_retry={() => void action_registry.execute(ACTION_IDS.note_retry_save)}
  on_cancel={() => void action_registry.execute(ACTION_IDS.note_cancel_save)}
/>

<SettingsDialog
  open={stores.ui.settings_dialog.open}
  editor_settings={stores.ui.settings_dialog.current_settings}
  is_saving={stores.op.is_pending("settings.save")}
  has_unsaved_changes={stores.ui.settings_dialog.has_unsaved_changes}
  error={settings_error}
  on_update_settings={(settings: EditorSettings) =>
    void action_registry.execute(ACTION_IDS.settings_update, settings)}
  on_save={() => void action_registry.execute(ACTION_IDS.settings_save)}
  on_close={() => void action_registry.execute(ACTION_IDS.settings_close)}
/>

<CreateFolderDialog
  open={stores.ui.create_folder_dialog.open}
  parent_path={stores.ui.create_folder_dialog.parent_path}
  folder_name={stores.ui.create_folder_dialog.folder_name}
  is_creating={stores.op.is_pending("folder.create")}
  error={create_folder_error}
  on_folder_name_change={(name: string) =>
    void action_registry.execute(ACTION_IDS.folder_update_create_name, name)}
  on_confirm={() =>
    void action_registry.execute(ACTION_IDS.folder_confirm_create)}
  on_cancel={() =>
    void action_registry.execute(ACTION_IDS.folder_cancel_create)}
/>

<Omnibar
  open={stores.ui.omnibar.open}
  query={stores.ui.omnibar.query}
  selected_index={stores.ui.omnibar.selected_index}
  is_searching={stores.ui.omnibar.is_searching}
  items={stores.search.omnibar_items}
  recent_notes={recent_notes_for_display}
  on_open_change={(open) => {
    if (open) {
      void action_registry.execute(ACTION_IDS.omnibar_open);
    } else {
      void action_registry.execute(ACTION_IDS.omnibar_close);
    }
  }}
  on_query_change={(query: string) =>
    void action_registry.execute(ACTION_IDS.omnibar_set_query, query)}
  on_selected_index_change={(index: number) =>
    void action_registry.execute(ACTION_IDS.omnibar_set_selected_index, index)}
  on_confirm={(item: OmnibarItem) =>
    void action_registry.execute(ACTION_IDS.omnibar_confirm_item, item)}
/>

<ImagePasteDialog
  open={stores.ui.image_paste_dialog.open}
  filename={stores.ui.image_paste_dialog.filename}
  estimated_size_bytes={stores.ui.image_paste_dialog.estimated_size_bytes}
  target_folder={stores.ui.image_paste_dialog.target_folder}
  image_bytes={stores.ui.image_paste_dialog.image?.bytes ?? null}
  image_mime_type={stores.ui.image_paste_dialog.image?.mime_type ?? null}
  is_saving={stores.op.is_pending("asset.write")}
  error={image_paste_error}
  on_update_filename={(filename: string) =>
    void action_registry.execute(
      ACTION_IDS.note_update_image_paste_filename,
      filename,
    )}
  on_confirm={() =>
    void action_registry.execute(ACTION_IDS.note_confirm_image_paste)}
  on_cancel={() =>
    void action_registry.execute(ACTION_IDS.note_cancel_image_paste)}
  on_retry={() =>
    void action_registry.execute(ACTION_IDS.note_confirm_image_paste)}
/>
