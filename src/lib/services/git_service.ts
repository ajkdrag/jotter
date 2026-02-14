import type { GitPort } from "$lib/ports/git_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { GitStore } from "$lib/stores/git_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { VaultPath } from "$lib/types/ids";
import { error_message } from "$lib/utils/error_message";

export class GitService {
  constructor(
    private readonly git_port: GitPort,
    private readonly vault_store: VaultStore,
    private readonly git_store: GitStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  private get_vault_path(): VaultPath {
    const vault_path = this.vault_store.vault?.path;
    if (!vault_path) throw new Error("No vault open");
    return vault_path;
  }

  private format_auto_commit_message(paths: string[]): string {
    const first = paths[0];
    if (paths.length === 1 && first) {
      const name = first.split("/").pop()?.replace(/\.md$/, "") ?? first;
      return `Update: ${String(name)}`;
    }
    return `Update ${String(paths.length)} files`;
  }

  async check_repo() {
    try {
      const vault_path = this.get_vault_path();
      const has_repo = await this.git_port.has_repo(vault_path);
      this.git_store.set_enabled(has_repo);
      if (has_repo) {
        await this.refresh_status();
      }
    } catch {
      this.git_store.set_enabled(false);
    }
  }

  async init_repo() {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.init", this.now_ms());
    try {
      await this.git_port.init_repo(vault_path);
      this.git_store.set_enabled(true);
      this.op_store.succeed("git.init");
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      this.op_store.fail("git.init", msg);
    }
  }

  async refresh_status() {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.status", this.now_ms());
    try {
      const status = await this.git_port.status(vault_path);
      this.git_store.set_status(
        status.branch,
        status.is_dirty,
        status.files.length,
      );
      this.op_store.succeed("git.status");
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      this.op_store.fail("git.status", msg);
    }
  }

  async auto_commit(paths: string[]) {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.commit", this.now_ms());
    this.git_store.set_sync_status("committing");
    try {
      const message = this.format_auto_commit_message(paths);
      await this.git_port.stage_and_commit(vault_path, message, paths);
      this.git_store.set_sync_status("idle");
      this.git_store.set_last_commit_time(this.now_ms());
      this.op_store.succeed("git.commit");
      await this.refresh_status();
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_sync_status("error");
      this.git_store.set_error(msg);
      this.op_store.fail("git.commit", msg);
    }
  }

  async create_checkpoint(description: string) {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.checkpoint", this.now_ms());
    this.git_store.set_sync_status("committing");
    try {
      await this.git_port.stage_and_commit(vault_path, description, null);
      this.git_store.set_sync_status("idle");
      this.git_store.set_last_commit_time(this.now_ms());
      this.op_store.succeed("git.checkpoint");
      await this.refresh_status();
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_sync_status("error");
      this.git_store.set_error(msg);
      this.op_store.fail("git.checkpoint", msg);
    }
  }

  async load_history(note_path: string | null, limit: number) {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.history", this.now_ms());
    try {
      const commits = await this.git_port.log(vault_path, note_path, limit);
      this.git_store.set_history(commits, note_path);
      this.op_store.succeed("git.history");
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      this.op_store.fail("git.history", msg);
    }
  }

  async get_diff(commit_a: string, commit_b: string, file_path: string | null) {
    const vault_path = this.get_vault_path();
    return await this.git_port.diff(vault_path, commit_a, commit_b, file_path);
  }

  async get_file_at_commit(file_path: string, commit_hash: string) {
    const vault_path = this.get_vault_path();
    return await this.git_port.show_file_at_commit(
      vault_path,
      file_path,
      commit_hash,
    );
  }

  async restore_version(file_path: string, commit_hash: string) {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.restore", this.now_ms());
    try {
      await this.git_port.restore_file(vault_path, file_path, commit_hash);
      this.op_store.succeed("git.restore");
      await this.refresh_status();
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      this.op_store.fail("git.restore", msg);
    }
  }
}
