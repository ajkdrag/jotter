import type { GitPort } from "$lib/features/git";

export function create_test_git_adapter(): GitPort {
  return {
    has_repo() {
      return Promise.resolve(false);
    },
    init_repo() {
      return Promise.resolve();
    },
    status() {
      return Promise.resolve({
        branch: "",
        is_dirty: false,
        ahead: 0,
        behind: 0,
        has_remote: false,
        has_upstream: false,
        remote_url: null,
        files: [],
      });
    },
    stage_and_commit() {
      return Promise.reject(
        new Error("git stage_and_commit not implemented in test adapter"),
      );
    },
    log() {
      return Promise.resolve([]);
    },
    diff() {
      return Promise.resolve({
        additions: 0,
        deletions: 0,
        hunks: [],
      });
    },
    show_file_at_commit() {
      return Promise.resolve("");
    },
    restore_file() {
      return Promise.resolve("");
    },
    create_tag() {
      return Promise.resolve();
    },
    push() {
      return Promise.resolve({ success: true, message: null, error: null });
    },
    fetch() {
      return Promise.resolve({ success: true, message: null, error: null });
    },
    pull() {
      return Promise.resolve({ success: true, message: null, error: null });
    },
    add_remote() {
      return Promise.resolve({ success: true, message: null, error: null });
    },
    push_with_upstream() {
      return Promise.resolve({ success: true, message: null, error: null });
    },
  };
}
