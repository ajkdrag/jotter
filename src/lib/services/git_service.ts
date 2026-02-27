import type { GitPort } from "$lib/ports/git_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { GitStore } from "$lib/stores/git_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { VaultPath } from "$lib/types/ids";
import { error_message } from "$lib/utils/error_message";

type CommitRunResult =
  | { status: "committed" }
  | { status: "skipped" }
  | { status: "no_repo" }
  | { status: "failed"; error: string };

export type GitInitResult =
  | { status: "initialized" }
  | { status: "already_repo" }
  | { status: "failed"; error: string };

export type GitCheckpointResult =
  | { status: "created" }
  | { status: "skipped" }
  | { status: "no_repo" }
  | { status: "failed"; error: string }
  | { status: "created"; warning: string };

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
    const timestamp = new Date(this.now_ms()).toISOString();
    const unique_titles = Array.from(
      new Set(paths.map((path) => this.extract_note_title(path))),
    );
    if (unique_titles.length === 0) {
      return `Update: workspace (${timestamp})`;
    }
    if (unique_titles.length === 1) {
      const only_title = unique_titles[0] ?? "workspace";
      return `Update: ${only_title} (${timestamp})`;
    }
    if (unique_titles.length <= 3) {
      return `Update: ${unique_titles.join(", ")} (${timestamp})`;
    }
    const head = unique_titles.slice(0, 3).join(", ");
    return `Update: ${head} +${String(unique_titles.length - 3)} more (${timestamp})`;
  }

  private extract_note_title(path: string): string {
    return path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  }

  private format_checkpoint_tag(description: string): string {
    const normalized = description
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const base = normalized || "checkpoint";
    return `checkpoint-${base}-${String(this.now_ms())}`;
  }

  private is_nothing_to_commit_error(error: unknown): boolean {
    const text = error_message(error).toLowerCase();
    return text.includes("nothing to commit");
  }

  private fail_when_no_repository(op_key: string): CommitRunResult {
    this.op_store.start(op_key, this.now_ms());
    this.op_store.fail(op_key, "No git repository");
    return { status: "no_repo" };
  }

  private begin_git_mutation(op_key: string): void {
    this.op_store.start(op_key, this.now_ms());
    this.git_store.set_sync_status("committing");
    this.git_store.set_error(null);
  }

  private async finish_git_mutation_success(
    op_key: string,
    options?: { track_last_commit?: boolean },
  ): Promise<void> {
    this.git_store.set_sync_status("idle");
    if (options?.track_last_commit) {
      this.git_store.set_last_commit_time(this.now_ms());
    }
    this.op_store.succeed(op_key);
    await this.refresh_status();
  }

  private fail_git_mutation(op_key: string, error: string): void {
    this.git_store.set_sync_status("error");
    this.git_store.set_error(error);
    this.op_store.fail(op_key, error);
  }

  private async run_commit(
    op_key: string,
    message: string,
    files: string[] | null,
  ): Promise<CommitRunResult> {
    const vault_path = this.get_vault_path();
    const has_repo = await this.git_port.has_repo(vault_path);
    if (!has_repo) {
      return this.fail_when_no_repository(op_key);
    }

    this.begin_git_mutation(op_key);

    try {
      const status = await this.git_port.status(vault_path);
      if (!status.is_dirty) {
        await this.finish_git_mutation_success(op_key);
        return { status: "skipped" };
      }

      await this.git_port.stage_and_commit(vault_path, message, files);
      await this.finish_git_mutation_success(op_key, {
        track_last_commit: true,
      });
      return { status: "committed" };
    } catch (err) {
      if (this.is_nothing_to_commit_error(err)) {
        await this.finish_git_mutation_success(op_key);
        return { status: "skipped" };
      }
      const msg = error_message(err);
      this.fail_git_mutation(op_key, msg);
      return { status: "failed", error: msg };
    }
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

  async init_repo(): Promise<GitInitResult> {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.init", this.now_ms());
    this.git_store.set_error(null);
    try {
      const has_repo = await this.git_port.has_repo(vault_path);
      if (has_repo) {
        this.git_store.set_enabled(true);
        this.op_store.succeed("git.init");
        await this.refresh_status();
        return { status: "already_repo" };
      }
      await this.git_port.init_repo(vault_path);
      this.git_store.set_enabled(true);
      this.op_store.succeed("git.init");
      await this.refresh_status();
      return { status: "initialized" };
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      this.op_store.fail("git.init", msg);
      return { status: "failed", error: msg };
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
    const message = this.format_auto_commit_message(paths);
    const commit_paths = paths.length > 0 ? paths : null;
    await this.run_commit("git.commit", message, commit_paths);
  }

  async commit_all() {
    const timestamp = new Date(this.now_ms()).toISOString();
    await this.run_commit("git.commit", `Update: manual (${timestamp})`, null);
  }

  async create_checkpoint(description: string): Promise<GitCheckpointResult> {
    const message = `Checkpoint: ${description}`;
    const result = await this.run_commit("git.checkpoint", message, null);
    if (result.status === "no_repo") {
      return { status: "no_repo" };
    }
    if (result.status === "skipped") {
      return { status: "skipped" };
    }
    if (result.status === "failed") {
      return { status: "failed", error: result.error };
    }

    try {
      const vault_path = this.get_vault_path();
      const tag_name = this.format_checkpoint_tag(description);
      await this.git_port.create_tag(vault_path, tag_name, message);
      return { status: "created" };
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      return { status: "created", warning: msg };
    }
  }

  async load_history(note_path: string | null, limit: number) {
    const vault_path = this.get_vault_path();
    this.op_store.start("git.history", this.now_ms());
    this.git_store.set_loading_history(true);
    try {
      const commits = await this.git_port.log(vault_path, note_path, limit);
      this.git_store.set_history(commits, note_path);
      this.op_store.succeed("git.history");
    } catch (err) {
      const msg = error_message(err);
      this.git_store.set_error(msg);
      this.op_store.fail("git.history", msg);
    } finally {
      this.git_store.set_loading_history(false);
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
    this.git_store.set_sync_status("committing");
    try {
      await this.git_port.restore_file(vault_path, file_path, commit_hash);
      await this.finish_git_mutation_success("git.restore", {
        track_last_commit: true,
      });
    } catch (err) {
      if (this.is_nothing_to_commit_error(err)) {
        await this.finish_git_mutation_success("git.restore");
        return;
      }
      const msg = error_message(err);
      this.fail_git_mutation("git.restore", msg);
    }
  }
}
