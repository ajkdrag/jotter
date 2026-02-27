import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { ACTION_IDS } from "$lib/actions/action_ids";
import type { GitDiff } from "$lib/types/git";
import { toast } from "svelte-sonner";

type CommitSelectionPayload = {
  hash: string;
  short_hash: string;
};

type CommitRestorePayload = {
  hash: string;
};

function parse_commit_selection_payload(
  payload: unknown,
): CommitSelectionPayload {
  const record = (payload ?? {}) as Record<string, unknown>;
  return {
    hash: typeof record.hash === "string" ? record.hash : "",
    short_hash: typeof record.short_hash === "string" ? record.short_hash : "",
  };
}

function parse_commit_restore_payload(payload: unknown): CommitRestorePayload {
  const record = (payload ?? {}) as Record<string, unknown>;
  return {
    hash: typeof record.hash === "string" ? record.hash : "",
  };
}

export function register_git_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  function open_version_history_dialog() {
    const note_path = stores.editor.open_note?.meta.path ?? null;
    stores.ui.version_history_dialog = {
      open: true,
      note_path,
    };
    return note_path;
  }

  function close_version_history_dialog() {
    stores.ui.version_history_dialog = {
      open: false,
      note_path: null,
    };
    stores.git.clear_history();
  }

  function open_checkpoint_dialog() {
    stores.ui.checkpoint_dialog = {
      open: true,
      description: "",
    };
  }

  function close_checkpoint_dialog() {
    stores.ui.checkpoint_dialog = {
      open: false,
      description: "",
    };
  }

  async function load_file_content_at_commit(
    note_path: typeof stores.ui.version_history_dialog.note_path,
    commit_hash: string,
  ): Promise<string | null> {
    if (!note_path) {
      return null;
    }
    try {
      return await services.git.get_file_at_commit(note_path, commit_hash);
    } catch {
      return null;
    }
  }

  async function resolve_selected_commit_content(
    commit_hash: string,
    note_path: typeof stores.ui.version_history_dialog.note_path,
  ): Promise<{ selected_diff: GitDiff | null; file_content: string | null }> {
    const parent_hash = `${commit_hash}~1`;
    const loaded_diff = await services.git.get_diff(
      parent_hash,
      commit_hash,
      note_path,
    );

    const has_diff =
      loaded_diff.hunks.length > 0 ||
      loaded_diff.additions > 0 ||
      loaded_diff.deletions > 0;
    if (has_diff) {
      return {
        selected_diff: loaded_diff,
        file_content: null,
      };
    }

    const file_content = await load_file_content_at_commit(
      note_path,
      commit_hash,
    );
    return {
      selected_diff: null,
      file_content,
    };
  }

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
      const note_path = open_version_history_dialog();
      await services.git.load_history(note_path, 50);
    },
  });

  registry.register({
    id: ACTION_IDS.git_close_history,
    label: "Close Version History",
    execute: () => {
      close_version_history_dialog();
    },
  });

  registry.register({
    id: ACTION_IDS.git_select_commit,
    label: "Select Commit",
    execute: async (payload: unknown) => {
      const commit = parse_commit_selection_payload(payload);
      if (!commit.hash) {
        return;
      }

      const note_path = stores.ui.version_history_dialog.note_path;
      stores.git.set_loading_diff(true);
      const matching = stores.git.history.find((c) => c.hash === commit.hash);

      try {
        const { selected_diff, file_content } =
          await resolve_selected_commit_content(commit.hash, note_path);
        stores.git.set_selected_commit(
          matching ?? null,
          selected_diff,
          file_content,
        );
      } catch {
        const file_content = await load_file_content_at_commit(
          note_path,
          commit.hash,
        );
        stores.git.set_selected_commit(matching ?? null, null, file_content);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.git_restore_version,
    label: "Restore Version",
    execute: async (payload: unknown) => {
      const commit = parse_commit_restore_payload(payload);
      if (!commit.hash) {
        return;
      }
      const note_path = stores.ui.version_history_dialog.note_path;
      if (!note_path) return;
      await services.git.restore_version(note_path, commit.hash);

      stores.tab.invalidate_cache_by_path(note_path);
      services.editor.close_buffer(note_path);

      await services.note.open_note(note_path, false, {
        force_reload: true,
      });

      close_version_history_dialog();
    },
  });

  registry.register({
    id: ACTION_IDS.git_open_checkpoint,
    label: "Create Checkpoint",
    execute: () => {
      open_checkpoint_dialog();
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
      close_checkpoint_dialog();
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
      close_checkpoint_dialog();
    },
  });
}
