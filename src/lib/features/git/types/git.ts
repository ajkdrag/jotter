export type GitSyncStatus =
  | "idle"
  | "committing"
  | "pushing"
  | "pulling"
  | "error";

export type GitFileStatus = {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "conflicted";
};

export type GitStatus = {
  branch: string;
  is_dirty: boolean;
  ahead: number;
  behind: number;
  has_remote: boolean;
  has_upstream: boolean;
  remote_url: string | null;
  files: GitFileStatus[];
};

export type GitRemoteResult = {
  success: boolean;
  message: string | null;
  error: string | null;
};

export type GitCommit = {
  hash: string;
  short_hash: string;
  author: string;
  timestamp_ms: number;
  message: string;
};

export type GitDiffLine = {
  type: "context" | "addition" | "deletion";
  content: string;
  old_line: number | null;
  new_line: number | null;
};

export type GitDiffHunk = {
  header: string;
  lines: GitDiffLine[];
};

export type GitDiff = {
  additions: number;
  deletions: number;
  hunks: GitDiffHunk[];
};
