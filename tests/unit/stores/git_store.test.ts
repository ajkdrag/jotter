import { describe, expect, it } from "vitest";
import { GitStore } from "$lib/stores/git_store.svelte";

describe("GitStore", () => {
  it("starts disabled with default values", () => {
    const store = new GitStore();
    expect(store.enabled).toBe(false);
    expect(store.branch).toBe("main");
    expect(store.is_dirty).toBe(false);
    expect(store.pending_files).toBe(0);
    expect(store.sync_status).toBe("idle");
    expect(store.last_commit_time).toBeNull();
    expect(store.error).toBeNull();
    expect(store.history).toEqual([]);
    expect(store.history_note_path).toBeNull();
    expect(store.selected_commit).toBeNull();
    expect(store.selected_diff).toBeNull();
    expect(store.is_loading_diff).toBe(false);
  });

  it("sets enabled state", () => {
    const store = new GitStore();
    store.set_enabled(true);
    expect(store.enabled).toBe(true);
  });

  it("sets status fields", () => {
    const store = new GitStore();
    store.set_status("feature/test", true, 3);
    expect(store.branch).toBe("feature/test");
    expect(store.is_dirty).toBe(true);
    expect(store.pending_files).toBe(3);
  });

  it("sets sync status", () => {
    const store = new GitStore();
    store.set_sync_status("committing");
    expect(store.sync_status).toBe("committing");
  });

  it("sets last commit time", () => {
    const store = new GitStore();
    store.set_last_commit_time(1234567890);
    expect(store.last_commit_time).toBe(1234567890);
  });

  it("sets and clears error", () => {
    const store = new GitStore();
    store.set_error("something broke");
    expect(store.error).toBe("something broke");
    store.set_error(null);
    expect(store.error).toBeNull();
  });

  it("sets and clears selected commit", () => {
    const store = new GitStore();
    const commit = {
      hash: "abc123",
      short_hash: "abc",
      author: "test",
      timestamp_ms: 1000,
      message: "initial",
    };
    const diff = { additions: 5, deletions: 2, hunks: [] };
    store.set_loading_diff(true);
    expect(store.is_loading_diff).toBe(true);
    store.set_selected_commit(commit, diff);
    expect(store.selected_commit).toEqual(commit);
    expect(store.selected_diff).toEqual(diff);
    expect(store.is_loading_diff).toBe(false);
  });

  it("sets and clears history", () => {
    const store = new GitStore();
    const commits = [
      {
        hash: "abc123",
        short_hash: "abc",
        author: "test",
        timestamp_ms: 1000,
        message: "initial",
      },
    ];
    store.set_history(commits, "notes/test.md");
    expect(store.history).toEqual(commits);
    expect(store.history_note_path).toBe("notes/test.md");

    store.clear_history();
    expect(store.history).toEqual([]);
    expect(store.history_note_path).toBeNull();
  });

  it("resets all state", () => {
    const store = new GitStore();
    store.set_enabled(true);
    store.set_status("dev", true, 5);
    store.set_sync_status("pushing");
    store.set_last_commit_time(9999);
    store.set_error("err");
    store.set_history(
      [
        {
          hash: "x",
          short_hash: "x",
          author: "a",
          timestamp_ms: 0,
          message: "m",
        },
      ],
      "p",
    );
    store.set_selected_commit(
      {
        hash: "x",
        short_hash: "x",
        author: "a",
        timestamp_ms: 0,
        message: "m",
      },
      { additions: 1, deletions: 0, hunks: [] },
    );

    store.reset();

    expect(store.enabled).toBe(false);
    expect(store.branch).toBe("main");
    expect(store.is_dirty).toBe(false);
    expect(store.pending_files).toBe(0);
    expect(store.sync_status).toBe("idle");
    expect(store.last_commit_time).toBeNull();
    expect(store.error).toBeNull();
    expect(store.history).toEqual([]);
    expect(store.history_note_path).toBeNull();
    expect(store.selected_commit).toBeNull();
    expect(store.selected_diff).toBeNull();
    expect(store.is_loading_diff).toBe(false);
  });
});
