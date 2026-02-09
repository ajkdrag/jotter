import { describe, expect, it, vi } from "vitest";
import { create_search_index_web } from "$lib/adapters/web/search_index_web";
import { as_markdown_text, as_note_path, as_vault_id } from "$lib/types/ids";
import type { NoteDoc } from "$lib/types/note";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";

function build_doc(path: string, title: string, markdown: string): NoteDoc {
  const note_path = as_note_path(path);
  return {
    meta: {
      id: note_path,
      path: note_path,
      title,
      mtime_ms: 0,
      size_bytes: markdown.length,
    },
    markdown: as_markdown_text(markdown),
  };
}

describe("search_index_web", () => {
  it("delegates index and query operations to SearchDbWeb", async () => {
    const rebuild_index = vi.fn().mockResolvedValue(undefined);
    const upsert_note = vi.fn().mockResolvedValue(undefined);
    const remove_note = vi.fn().mockResolvedValue(undefined);
    const search = vi.fn().mockResolvedValue([]);
    const suggest = vi.fn().mockResolvedValue([]);
    const subscribe_progress = vi.fn().mockReturnValue(() => {});
    const search_db = {
      rebuild_index,
      upsert_note,
      remove_note,
      search,
      suggest,
      subscribe_progress,
    } as unknown as SearchDbWeb;
    const index = create_search_index_web(search_db);
    const vault_id = as_vault_id("vault-1");
    const docs = [
      build_doc("alpha.md", "Alpha Note", "alpha text"),
      build_doc("beta.md", "Beta Note", "beta text"),
    ];
    const first_doc = docs[0];
    if (!first_doc) throw new Error("expected docs");

    await index.build_index(vault_id, docs);
    await index.upsert_note(vault_id, first_doc);
    await index.remove_note(vault_id, as_note_path("beta.md"));
    await index.search(
      vault_id,
      { raw: "alpha", text: "alpha", scope: "all", domain: "notes" },
      10,
    );
    await index.suggest(vault_id, "alp", 5);

    expect(rebuild_index).toHaveBeenCalledWith(vault_id, docs);
    expect(upsert_note).toHaveBeenCalledWith(vault_id, first_doc);
    expect(remove_note).toHaveBeenCalledWith(vault_id, as_note_path("beta.md"));
    expect(search).toHaveBeenCalledWith(
      vault_id,
      { raw: "alpha", text: "alpha", scope: "all", domain: "notes" },
      10,
    );
    expect(suggest).toHaveBeenCalledWith(vault_id, "alp", 5);
  });

  it("forwards progress subscription", () => {
    const unsubscribe = vi.fn();
    const subscribe_progress = vi.fn().mockReturnValue(unsubscribe);
    const search_db = {
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn().mockResolvedValue(undefined),
      remove_note: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      suggest: vi.fn().mockResolvedValue([]),
      subscribe_progress,
    } as unknown as SearchDbWeb;

    const index = create_search_index_web(search_db);
    const callback = vi.fn();
    const detach = index.subscribe_index_progress(callback);

    expect(subscribe_progress).toHaveBeenCalledWith(callback);
    detach();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
