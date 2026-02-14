import type { VaultPath } from "$lib/types/ids";
import type { GitCommit, GitDiff, GitStatus } from "$lib/types/git";

export interface GitPort {
  has_repo(vault_path: VaultPath): Promise<boolean>;
  init_repo(vault_path: VaultPath): Promise<void>;
  status(vault_path: VaultPath): Promise<GitStatus>;
  stage_and_commit(
    vault_path: VaultPath,
    message: string,
    files: string[] | null,
  ): Promise<string>;
  log(
    vault_path: VaultPath,
    file_path: string | null,
    limit: number,
  ): Promise<GitCommit[]>;
  diff(
    vault_path: VaultPath,
    commit_a: string,
    commit_b: string,
    file_path: string | null,
  ): Promise<GitDiff>;
  show_file_at_commit(
    vault_path: VaultPath,
    file_path: string,
    commit_hash: string,
  ): Promise<string>;
  restore_file(
    vault_path: VaultPath,
    file_path: string,
    commit_hash: string,
  ): Promise<string>;
}
