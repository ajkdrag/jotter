import type { GitPort } from "$lib/ports/git_port";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";
import type { VaultPath } from "$lib/types/ids";
import type { GitCommit, GitDiff, GitStatus } from "$lib/types/git";

export function create_git_tauri_adapter(): GitPort {
  return {
    async has_repo(vault_path: VaultPath) {
      return await tauri_invoke<boolean>("git_has_repo", {
        vaultPath: vault_path,
      });
    },
    async init_repo(vault_path: VaultPath) {
      await tauri_invoke<undefined>("git_init_repo", {
        vaultPath: vault_path,
      });
    },
    async status(vault_path: VaultPath) {
      return await tauri_invoke<GitStatus>("git_status", {
        vaultPath: vault_path,
      });
    },
    async stage_and_commit(
      vault_path: VaultPath,
      message: string,
      files: string[] | null,
    ) {
      return await tauri_invoke<string>("git_stage_and_commit", {
        vaultPath: vault_path,
        message,
        files,
      });
    },
    async log(vault_path: VaultPath, file_path: string | null, limit: number) {
      return await tauri_invoke<GitCommit[]>("git_log", {
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
      return await tauri_invoke<GitDiff>("git_diff", {
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
      return await tauri_invoke<string>("git_show_file_at_commit", {
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
      return await tauri_invoke<string>("git_restore_file", {
        vaultPath: vault_path,
        filePath: file_path,
        commitHash: commit_hash,
      });
    },
  };
}
