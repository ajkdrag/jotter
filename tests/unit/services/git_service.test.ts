import { describe, expect, it, vi } from "vitest";
import { GitService } from "$lib/services/git_service";
import { GitStore } from "$lib/stores/git_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import type { GitPort } from "$lib/ports/git_port";
import { create_test_vault } from "../helpers/test_fixtures";

function create_mock_port() {
  const has_repo = vi.fn().mockResolvedValue(true);
  const init_repo = vi.fn().mockResolvedValue(undefined);
  const status = vi.fn().mockResolvedValue({
    branch: "main",
    is_dirty: false,
    ahead: 0,
    behind: 0,
    files: [],
  });
  const stage_and_commit = vi.fn().mockResolvedValue("abc123");
  const log = vi.fn().mockResolvedValue([]);
  const diff = vi
    .fn()
    .mockResolvedValue({ additions: 0, deletions: 0, hunks: [] });
  const show_file_at_commit = vi.fn().mockResolvedValue("file content");
  const restore_file = vi.fn().mockResolvedValue("def456");
  const create_tag = vi.fn().mockResolvedValue(undefined);

  const port: GitPort = {
    has_repo,
    init_repo,
    status,
    stage_and_commit,
    log,
    diff,
    show_file_at_commit,
    restore_file,
    create_tag,
  };

  return {
    port,
    has_repo,
    init_repo,
    status,
    stage_and_commit,
    log,
    diff,
    show_file_at_commit,
    restore_file,
    create_tag,
  };
}

function create_harness() {
  const mocks = create_mock_port();
  const vault_store = new VaultStore();
  const git_store = new GitStore();
  const op_store = new OpStore();
  const now_ms = vi.fn().mockReturnValue(1000);

  vault_store.set_vault(create_test_vault());

  const service = new GitService(
    mocks.port,
    vault_store,
    git_store,
    op_store,
    now_ms,
  );
  return { service, ...mocks, vault_store, git_store, op_store, now_ms };
}

describe("GitService", () => {
  it("check_repo sets enabled on store", async () => {
    const { service, git_store } = create_harness();
    await service.check_repo();
    expect(git_store.enabled).toBe(true);
  });

  it("check_repo sets disabled when no repo", async () => {
    const { service, has_repo, git_store } = create_harness();
    has_repo.mockResolvedValue(false);
    await service.check_repo();
    expect(git_store.enabled).toBe(false);
  });

  it("init_repo calls port and enables store", async () => {
    const { service, has_repo, init_repo, git_store, op_store } =
      create_harness();
    has_repo.mockResolvedValue(false);
    const result = await service.init_repo();
    expect(init_repo).toHaveBeenCalled();
    expect(git_store.enabled).toBe(true);
    expect(op_store.get("git.init").status).toBe("success");
    expect(result).toEqual({ status: "initialized" });
  });

  it("init_repo does not reinitialize existing repo", async () => {
    const { service, has_repo, init_repo, op_store } = create_harness();
    has_repo.mockResolvedValue(true);
    const result = await service.init_repo();
    expect(init_repo).not.toHaveBeenCalled();
    expect(op_store.get("git.init").status).toBe("success");
    expect(result).toEqual({ status: "already_repo" });
  });

  it("init_repo handles errors", async () => {
    const { service, has_repo, init_repo, git_store, op_store } =
      create_harness();
    has_repo.mockResolvedValue(false);
    init_repo.mockRejectedValue(new Error("init failed"));
    const result = await service.init_repo();
    expect(git_store.error).toBe("init failed");
    expect(op_store.get("git.init").status).toBe("error");
    expect(result).toEqual({ status: "failed", error: "init failed" });
  });

  it("refresh_status updates store", async () => {
    const { service, status, git_store } = create_harness();
    status.mockResolvedValue({
      branch: "dev",
      is_dirty: true,
      ahead: 1,
      behind: 0,
      files: [{ path: "a.md", status: "modified" }],
    });
    await service.refresh_status();
    expect(git_store.branch).toBe("dev");
    expect(git_store.is_dirty).toBe(true);
    expect(git_store.pending_files).toBe(1);
  });

  it("auto_commit single file uses note title in message", async () => {
    const { service, stage_and_commit, status, git_store } = create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: true,
      ahead: 0,
      behind: 0,
      files: [{ path: "notes/my_note.md", status: "modified" }],
    });
    await service.auto_commit(["notes/my_note.md"]);
    expect(stage_and_commit).toHaveBeenCalledWith(
      expect.anything(),
      "Update: my_note (1970-01-01T00:00:01.000Z)",
      ["notes/my_note.md"],
    );
    expect(git_store.sync_status).toBe("idle");
    expect(git_store.last_commit_time).toBe(1000);
    expect(status).toHaveBeenCalled();
  });

  it("auto_commit multiple files uses count in message", async () => {
    const { service, stage_and_commit, status } = create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: true,
      ahead: 0,
      behind: 0,
      files: [{ path: "a.md", status: "modified" }],
    });
    await service.auto_commit(["a.md", "b.md"]);
    expect(stage_and_commit).toHaveBeenCalledWith(
      expect.anything(),
      "Update: a, b (1970-01-01T00:00:01.000Z)",
      ["a.md", "b.md"],
    );
  });

  it("auto_commit handles errors", async () => {
    const { service, stage_and_commit, status, git_store, op_store } =
      create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: true,
      ahead: 0,
      behind: 0,
      files: [{ path: "a.md", status: "modified" }],
    });
    stage_and_commit.mockRejectedValue(new Error("commit failed"));
    await service.auto_commit(["a.md"]);
    expect(git_store.sync_status).toBe("error");
    expect(git_store.error).toBe("commit failed");
    expect(op_store.get("git.commit").status).toBe("error");
  });

  it("create_checkpoint commits with description", async () => {
    const { service, stage_and_commit, status, create_tag } = create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: true,
      ahead: 0,
      behind: 0,
      files: [{ path: "a.md", status: "modified" }],
    });
    const result = await service.create_checkpoint("My checkpoint");
    expect(stage_and_commit).toHaveBeenCalledWith(
      expect.anything(),
      "Checkpoint: My checkpoint",
      null,
    );
    expect(create_tag).toHaveBeenCalledTimes(1);
    expect(create_tag).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("checkpoint-my-checkpoint-"),
      "Checkpoint: My checkpoint",
    );
    expect(result).toEqual({ status: "created" });
  });

  it("create_checkpoint returns skipped when there is no diff", async () => {
    const { service, status, stage_and_commit, create_tag } = create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: false,
      ahead: 0,
      behind: 0,
      files: [],
    });

    const result = await service.create_checkpoint("No-op");
    expect(stage_and_commit).not.toHaveBeenCalled();
    expect(create_tag).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "skipped" });
  });

  it("commit_all stages all changes with manual message", async () => {
    const { service, stage_and_commit, status } = create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: true,
      ahead: 0,
      behind: 0,
      files: [{ path: "a.md", status: "modified" }],
    });
    await service.commit_all();
    expect(stage_and_commit).toHaveBeenCalledWith(
      expect.anything(),
      "Update: manual (1970-01-01T00:00:01.000Z)",
      null,
    );
  });

  it("skips commit when status is clean", async () => {
    const { service, stage_and_commit, status, op_store } = create_harness();
    status.mockResolvedValue({
      branch: "main",
      is_dirty: false,
      ahead: 0,
      behind: 0,
      files: [],
    });
    await service.auto_commit(["a.md"]);
    expect(stage_and_commit).not.toHaveBeenCalled();
    expect(op_store.get("git.commit").status).toBe("success");
  });

  it("load_history populates store", async () => {
    const { service, log, git_store } = create_harness();
    const commits = [
      {
        hash: "abc",
        short_hash: "ab",
        author: "test",
        timestamp_ms: 100,
        message: "msg",
      },
    ];
    log.mockResolvedValue(commits);
    await service.load_history("notes/test.md", 50);
    expect(git_store.history).toEqual(commits);
    expect(git_store.history_note_path).toBe("notes/test.md");
    expect(git_store.is_loading_history).toBe(false);
  });

  it("get_diff delegates to port", async () => {
    const { service, diff } = create_harness();
    await service.get_diff("aaa", "bbb", "file.md");
    expect(diff).toHaveBeenCalledWith(
      expect.anything(),
      "aaa",
      "bbb",
      "file.md",
    );
  });

  it("get_file_at_commit delegates to port", async () => {
    const { service, show_file_at_commit } = create_harness();
    const result = await service.get_file_at_commit("file.md", "abc");
    expect(result).toBe("file content");
    expect(show_file_at_commit).toHaveBeenCalledWith(
      expect.anything(),
      "file.md",
      "abc",
    );
  });

  it("restore_version calls port and refreshes status", async () => {
    const { service, restore_file, status, op_store, git_store } =
      create_harness();
    await service.restore_version("file.md", "abc123");
    expect(restore_file).toHaveBeenCalledWith(
      expect.anything(),
      "file.md",
      "abc123",
    );
    expect(op_store.get("git.restore").status).toBe("success");
    expect(git_store.sync_status).toBe("idle");
    expect(git_store.last_commit_time).toBe(1000);
    expect(status).toHaveBeenCalled();
  });

  it("restore_version treats nothing-to-commit as success", async () => {
    const { service, restore_file, op_store, git_store } = create_harness();
    restore_file.mockRejectedValue(new Error("nothing to commit"));

    await service.restore_version("file.md", "abc123");

    expect(op_store.get("git.restore").status).toBe("success");
    expect(git_store.sync_status).toBe("idle");
    expect(git_store.error).toBeNull();
  });

  it("disables git when no vault is open", async () => {
    const { service, vault_store, git_store } = create_harness();
    vault_store.clear();
    await service.check_repo();
    expect(git_store.enabled).toBe(false);
  });
});
