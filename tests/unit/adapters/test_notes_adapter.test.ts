import { describe, it, expect } from "vitest";
import { create_test_notes_adapter } from "../../adapters/test_notes_adapter";
import {
  as_markdown_text,
  as_note_path,
  as_vault_id,
} from "$lib/shared/types/ids";

describe("test_notes_adapter", () => {
  it("lists default notes", async () => {
    const adapter = create_test_notes_adapter();
    const notes = await adapter.list_notes(as_vault_id("vault-1"));

    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]?.path).toContain(".md");
  });

  it("creates folders and lists them", async () => {
    const adapter = create_test_notes_adapter();
    const vault_id = as_vault_id("vault-1");

    await adapter.create_folder(vault_id, "", "docs");
    await adapter.create_folder(vault_id, "docs", "nested");

    const folders = await adapter.list_folders(vault_id);
    expect(folders).toContain("docs");
    expect(folders).toContain("docs/nested");
  });

  it("creates note and returns metadata", async () => {
    const adapter = create_test_notes_adapter();
    const note = await adapter.create_note(
      as_vault_id("vault-1"),
      as_note_path("new-note.md"),
      as_markdown_text("content"),
    );

    expect(note.path).toBe("new-note.md");
    expect(note.title).toBe("new-note");
  });
});
