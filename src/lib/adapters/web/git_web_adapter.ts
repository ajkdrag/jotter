import type { GitPort } from "$lib/ports/git_port";

export function create_git_web_adapter(): GitPort {
  const not_supported = () =>
    Promise.reject(new Error("Git requires desktop app"));
  return {
    has_repo: () => Promise.resolve(false),
    init_repo: not_supported,
    status: not_supported,
    stage_and_commit: not_supported,
    log: not_supported,
    diff: not_supported,
    show_file_at_commit: not_supported,
    restore_file: not_supported,
  };
}
