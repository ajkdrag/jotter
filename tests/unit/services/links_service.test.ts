import { describe, expect, it, vi } from "vitest";
import { LinksService } from "$lib/services/links_service";
import { LinksStore } from "$lib/stores/links_store.svelte";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { as_note_path } from "$lib/types/ids";
import { create_test_vault } from "../helpers/test_fixtures";
import type { NoteMeta } from "$lib/types/note";

function note(path: string): NoteMeta {
  return {
    id: as_note_path(path),
    path: as_note_path(path),
    name: path.split("/").pop()?.replace(".md", "") ?? "",
    title: path.split("/").pop()?.replace(".md", "") ?? "",
    mtime_ms: 0,
    size_bytes: 0,
  };
}

function create_deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("LinksService", () => {
  it("loads note links snapshot from port", async () => {
    const snapshot = {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: ["missing/c.md"],
    };
    const search_port = {
      search_notes: vi.fn().mockResolvedValue([]),
      suggest_wiki_links: vi.fn().mockResolvedValue([]),
      get_note_links_snapshot: vi.fn().mockResolvedValue(snapshot),
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault());
    const links_store = new LinksStore();

    const service = new LinksService(search_port, vault_store, links_store);
    await service.load_note_links("target.md");

    expect(search_port.get_note_links_snapshot).toHaveBeenCalledWith(
      "vault-1",
      "target.md",
    );
    expect(links_store.active_note_path).toBe("target.md");
    expect(links_store.backlinks).toEqual(snapshot.backlinks);
    expect(links_store.outlinks).toEqual(snapshot.outlinks);
    expect(links_store.orphan_links).toEqual(snapshot.orphan_links);
  });

  it("clears state when no vault is selected", async () => {
    const search_port = {
      search_notes: vi.fn(),
      suggest_wiki_links: vi.fn(),
      get_note_links_snapshot: vi.fn(),
    };

    const vault_store = new VaultStore();
    const links_store = new LinksStore();
    links_store.set_snapshot("old.md", {
      backlinks: [note("x.md")],
      outlinks: [note("y.md")],
      orphan_links: ["missing/z.md"],
    });

    const service = new LinksService(search_port, vault_store, links_store);
    await service.load_note_links("target.md");

    expect(search_port.get_note_links_snapshot).not.toHaveBeenCalled();
    expect(links_store.active_note_path).toBeNull();
    expect(links_store.backlinks).toEqual([]);
    expect(links_store.outlinks).toEqual([]);
    expect(links_store.orphan_links).toEqual([]);
  });

  it("ignores stale out-of-order responses", async () => {
    const first = create_deferred<{
      backlinks: NoteMeta[];
      outlinks: NoteMeta[];
      orphan_links: string[];
    }>();
    const second = create_deferred<{
      backlinks: NoteMeta[];
      outlinks: NoteMeta[];
      orphan_links: string[];
    }>();
    let call_count = 0;

    const search_port = {
      search_notes: vi.fn(),
      suggest_wiki_links: vi.fn(),
      get_note_links_snapshot: vi.fn().mockImplementation(() => {
        call_count += 1;
        return call_count === 1 ? first.promise : second.promise;
      }),
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault());
    const links_store = new LinksStore();
    const service = new LinksService(search_port, vault_store, links_store);

    const first_load = service.load_note_links("a.md");
    const second_load = service.load_note_links("b.md");

    second.resolve({
      backlinks: [note("b/back.md")],
      outlinks: [note("b/out.md")],
      orphan_links: ["b/missing.md"],
    });
    await second_load;

    first.resolve({
      backlinks: [note("a/back.md")],
      outlinks: [note("a/out.md")],
      orphan_links: ["a/missing.md"],
    });
    await first_load;

    expect(links_store.active_note_path).toBe("b.md");
    expect(links_store.backlinks.map((entry) => entry.path)).toEqual([
      "b/back.md",
    ]);
    expect(links_store.outlinks.map((entry) => entry.path)).toEqual([
      "b/out.md",
    ]);
    expect(links_store.orphan_links).toEqual(["b/missing.md"]);
  });

  it("invalidates in-flight loads on clear()", async () => {
    const deferred = create_deferred<{
      backlinks: NoteMeta[];
      outlinks: NoteMeta[];
      orphan_links: string[];
    }>();
    const search_port = {
      search_notes: vi.fn(),
      suggest_wiki_links: vi.fn(),
      get_note_links_snapshot: vi.fn().mockReturnValue(deferred.promise),
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault());
    const links_store = new LinksStore();
    const service = new LinksService(search_port, vault_store, links_store);

    const inflight = service.load_note_links("target.md");
    service.clear();

    deferred.resolve({
      backlinks: [note("x.md")],
      outlinks: [note("y.md")],
      orphan_links: ["missing/z.md"],
    });
    await inflight;

    expect(links_store.active_note_path).toBeNull();
    expect(links_store.backlinks).toEqual([]);
    expect(links_store.outlinks).toEqual([]);
    expect(links_store.orphan_links).toEqual([]);
  });
});
