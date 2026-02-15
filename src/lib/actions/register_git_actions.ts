import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { ACTION_IDS } from "$lib/actions/action_ids";
import type { GitDiff } from "$lib/types/git";
import { toast } from "svelte-sonner";

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
      const result = await services.git.init_repo();
      if (result.status === "already_repo") {
        toast.info("Git repository is already initialized");
        return;
      }
      if (result.status === "initialized") {
        toast.success("Git repository initialized");
        return;
      }
      toast.error(result.error);
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
      await services.git.commit_all();
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
      if (!commit.hash) return;
      const note_path = stores.ui.version_history_dialog.note_path;
      stores.git.set_loading_diff(true);
      const matching = stores.git.history.find((c) => c.hash === commit.hash);
      try {
        const parent_hash = `${commit.hash}~1`;
        const loaded_diff = await services.git.get_diff(
          parent_hash,
          commit.hash,
          note_path,
        );
        let selected_diff: GitDiff | null = loaded_diff;
        let file_content: string | null = null;

        const has_diff =
          loaded_diff.hunks.length > 0 ||
          loaded_diff.additions > 0 ||
          loaded_diff.deletions > 0;

        if (!has_diff && note_path) {
          file_content = await services.git.get_file_at_commit(
            note_path,
            commit.hash,
          );
          selected_diff = null;
        }

        stores.git.set_selected_commit(
          matching ?? null,
          selected_diff,
          file_content,
        );
      } catch {
        let file_content: string | null = null;
        if (note_path) {
          try {
            file_content = await services.git.get_file_at_commit(
              note_path,
              commit.hash,
            );
          } catch {
            file_content = null;
          }
        }
        stores.git.set_selected_commit(matching ?? null, null, file_content);
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

      stores.tab.invalidate_cache_by_path(note_path);
      services.editor.close_buffer(note_path);

      await services.note.open_note(note_path, false, {
        force_reload: true,
      });

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
      const toast_id = toast.loading("Creating checkpoint commit...");
      const result = await services.git.create_checkpoint(description);
      if (result.status === "created") {
        if ("warning" in result && result.warning) {
          toast.warning("Checkpoint created, but tag creation failed", {
            id: toast_id,
          });
          return;
        }
        toast.success("Checkpoint created", { id: toast_id });
        return;
      }
      if (result.status === "no_repo") {
        toast.error("No git repository found", {
          id: toast_id,
          action: {
            label: "Initialize",
            onClick: () => {
              void registry.execute(ACTION_IDS.git_init);
            },
          },
        });
        return;
      }
      if (result.status === "skipped") {
        toast.info("No changes to checkpoint", { id: toast_id });
        return;
      }
      toast.error(result.error, { id: toast_id });
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
