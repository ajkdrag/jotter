import type { GitPort } from "$lib/features/git/ports";
import { tauri_invoke } from "$lib/shared/adapters/tauri_invoke";
import type { VaultPath } from "$lib/shared/types/ids";
import type { GitCommit, GitDiff, GitStatus } from "$lib/shared/types/git";

export function create_git_tauri_adapter(): GitPort {
  const invoke_git = <Result>(
    command: string,
    payload: Record<string, unknown>,
  ) => tauri_invoke<Result>(command, payload);

  return {
    async has_repo(vault_path: VaultPath) {
      return await invoke_git<boolean>("git_has_repo", {
        vaultPath: vault_path,
      });
    },
    async init_repo(vault_path: VaultPath) {
      await invoke_git<undefined>("git_init_repo", {
        vaultPath: vault_path,
      });
    },
    async status(vault_path: VaultPath) {
      return await invoke_git<GitStatus>("git_status", {
        vaultPath: vault_path,
      });
    },
    async stage_and_commit(
      vault_path: VaultPath,
      message: string,
      files: string[] | null,
    ) {
      return await invoke_git<string>("git_stage_and_commit", {
        vaultPath: vault_path,
        message,
        files,
      });
    },
    async log(vault_path: VaultPath, file_path: string | null, limit: number) {
      return await invoke_git<GitCommit[]>("git_log", {
        vaultPath: vault_path,
        filePath: file_path,
        limit,
      });
    },
    async diff(
      vault_path: VaultPath,
      commit_a: string,
      commit_b: string,
      file_path: string | null,
    ) {
      return await invoke_git<GitDiff>("git_diff", {
        vaultPath: vault_path,
        commitA: commit_a,
        commitB: commit_b,
        filePath: file_path,
      });
    },
    async show_file_at_commit(
      vault_path: VaultPath,
      file_path: string,
      commit_hash: string,
    ) {
      return await invoke_git<string>("git_show_file_at_commit", {
        vaultPath: vault_path,
        filePath: file_path,
        commitHash: commit_hash,
      });
    },
    async restore_file(
      vault_path: VaultPath,
      file_path: string,
      commit_hash: string,
    ) {
      return await invoke_git<string>("git_restore_file", {
        vaultPath: vault_path,
        filePath: file_path,
        commitHash: commit_hash,
      });
    },
    async create_tag(vault_path: VaultPath, name: string, message: string) {
      await invoke_git<undefined>("git_create_tag", {
        vaultPath: vault_path,
        name,
        message,
      });
    },
  };
}
