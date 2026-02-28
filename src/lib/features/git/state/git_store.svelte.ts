import type {
  GitSyncStatus,
  GitCommit,
  GitDiff,
} from "$lib/features/git/types/git";

export class GitStore {
  enabled = $state(false);
  branch = $state("main");
  is_dirty = $state(false);
  pending_files = $state(0);
  sync_status = $state<GitSyncStatus>("idle");
  last_commit_time = $state<number | null>(null);
  error = $state<string | null>(null);

  history = $state<GitCommit[]>([]);
  history_note_path = $state<string | null>(null);
  is_loading_history = $state(false);
  selected_commit = $state<GitCommit | null>(null);
  selected_diff = $state<GitDiff | null>(null);
  selected_file_content = $state<string | null>(null);
  is_loading_diff = $state(false);

  set_status(branch: string, is_dirty: boolean, pending_files: number) {
    this.branch = branch;
    this.is_dirty = is_dirty;
    this.pending_files = pending_files;
  }

  set_enabled(enabled: boolean) {
    this.enabled = enabled;
  }

  set_sync_status(status: GitSyncStatus) {
    this.sync_status = status;
  }

  set_last_commit_time(time: number) {
    this.last_commit_time = time;
  }

  set_error(error: string | null) {
    this.error = error;
  }

  set_history(commits: GitCommit[], note_path: string | null) {
    this.history = commits;
    this.history_note_path = note_path;
    this.selected_commit = null;
    this.selected_diff = null;
    this.selected_file_content = null;
  }

  set_loading_history(loading: boolean) {
    this.is_loading_history = loading;
  }

  set_selected_commit(
    commit: GitCommit | null,
    diff: GitDiff | null,
    file_content: string | null,
  ) {
    this.selected_commit = commit;
    this.selected_diff = diff;
    this.selected_file_content = file_content;
    this.is_loading_diff = false;
  }

  set_loading_diff(loading: boolean) {
    this.is_loading_diff = loading;
  }

  clear_history() {
    this.history = [];
    this.history_note_path = null;
    this.is_loading_history = false;
    this.selected_commit = null;
    this.selected_diff = null;
    this.selected_file_content = null;
    this.is_loading_diff = false;
  }

  reset() {
    this.enabled = false;
    this.branch = "main";
    this.is_dirty = false;
    this.pending_files = 0;
    this.sync_status = "idle";
    this.last_commit_time = null;
    this.error = null;
    this.history = [];
    this.history_note_path = null;
    this.is_loading_history = false;
    this.selected_commit = null;
    this.selected_diff = null;
    this.selected_file_content = null;
    this.is_loading_diff = false;
  }
}
