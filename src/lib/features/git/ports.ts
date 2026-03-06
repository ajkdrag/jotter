import type { VaultPath } from "$lib/shared/types/ids";
import type {
  GitCommit,
  GitDiff,
  GitRemoteResult,
  GitStatus,
} from "$lib/features/git/types/git";

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
  create_tag(
    vault_path: VaultPath,
    name: string,
    message: string,
  ): Promise<void>;
  push(vault_path: VaultPath): Promise<GitRemoteResult>;
  fetch(vault_path: VaultPath): Promise<GitRemoteResult>;
  pull(vault_path: VaultPath): Promise<GitRemoteResult>;
  add_remote(vault_path: VaultPath, url: string): Promise<GitRemoteResult>;
  push_with_upstream(
    vault_path: VaultPath,
    branch: string,
  ): Promise<GitRemoteResult>;
}
