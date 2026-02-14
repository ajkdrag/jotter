import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { ACTION_IDS } from "$lib/actions/action_ids";

export function register_git_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  registry.register({
    id: ACTION_IDS.git_check_repo,
    label: "Check Git Repository",
    execute: async () => {
      await services.git.check_repo();
    },
  });

  registry.register({
    id: ACTION_IDS.git_init,
    label: "Initialize Git Repository",
    execute: async () => {
      await services.git.init_repo();
    },
  });

  registry.register({
    id: ACTION_IDS.git_refresh_status,
    label: "Refresh Git Status",
    execute: async () => {
      await services.git.refresh_status();
    },
  });

  registry.register({
    id: ACTION_IDS.git_commit_all,
    label: "Commit All Changes",
    execute: async () => {
      const status = stores.git;
      if (!status.is_dirty) return;
      await services.git.auto_commit([]);
    },
  });

  registry.register({
    id: ACTION_IDS.git_open_history,
    label: "Open Version History",
    execute: async () => {
      const note_path = stores.editor.open_note?.meta.path ?? null;
      stores.ui.version_history_dialog = {
        open: true,
        note_path,
      };
      await services.git.load_history(note_path, 50);
    },
  });

  registry.register({
    id: ACTION_IDS.git_close_history,
    label: "Close Version History",
    execute: () => {
      stores.ui.version_history_dialog = {
        open: false,
        note_path: null,
      };
      stores.git.clear_history();
    },
  });

  registry.register({
    id: ACTION_IDS.git_select_commit,
    label: "Select Commit",
    execute: async (payload: unknown) => {
      const commit = payload as { hash: string; short_hash: string };
      const note_path = stores.ui.version_history_dialog.note_path;
      stores.git.set_loading_diff(true);
      try {
        const parent_hash = `${commit.hash}~1`;
        const diff = await services.git.get_diff(
          parent_hash,
          commit.hash,
          note_path,
        );
        const matching = stores.git.history.find((c) => c.hash === commit.hash);
        stores.git.set_selected_commit(matching ?? null, diff);
      } catch {
        const matching = stores.git.history.find((c) => c.hash === commit.hash);
        stores.git.set_selected_commit(matching ?? null, null);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.git_restore_version,
    label: "Restore Version",
    execute: async (payload: unknown) => {
      const commit = payload as { hash: string };
      const note_path = stores.ui.version_history_dialog.note_path;
      if (!note_path) return;
      await services.git.restore_version(note_path, commit.hash);
      stores.ui.version_history_dialog = { open: false, note_path: null };
      stores.git.clear_history();
    },
  });

  registry.register({
    id: ACTION_IDS.git_open_checkpoint,
    label: "Create Checkpoint",
    execute: () => {
      stores.ui.checkpoint_dialog = {
        open: true,
        description: "",
      };
    },
  });

  registry.register({
    id: ACTION_IDS.git_update_checkpoint_description,
    label: "Update Checkpoint Description",
    execute: (description: unknown) => {
      stores.ui.checkpoint_dialog.description = String(description);
    },
  });

  registry.register({
    id: ACTION_IDS.git_confirm_checkpoint,
    label: "Confirm Checkpoint",
    execute: async () => {
      const description = stores.ui.checkpoint_dialog.description.trim();
      if (!description) return;
      stores.ui.checkpoint_dialog = { open: false, description: "" };
      await services.git.create_checkpoint(description);
    },
  });

  registry.register({
    id: ACTION_IDS.git_cancel_checkpoint,
    label: "Cancel Checkpoint",
    execute: () => {
      stores.ui.checkpoint_dialog = { open: false, description: "" };
    },
  });
}
