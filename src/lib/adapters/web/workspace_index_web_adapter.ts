import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { NoteId, VaultId } from "$lib/types/ids";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchIndexWeb } from "$lib/adapters/web/search_index_web";

export function create_workspace_index_web_adapter(
  notes: NotesPort,
  search_index: SearchIndexWeb,
): WorkspaceIndexPort {
  return {
    async build_index(vault_id: VaultId): Promise<void> {
      const metas = await notes.list_notes(vault_id);
      const docs = await Promise.all(
        metas.map((meta) => notes.read_note(vault_id, meta.id)),
      );
      search_index.build_index(vault_id, docs);
    },
    async upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      const doc = await notes.read_note(vault_id, note_id);
      search_index.upsert_note(vault_id, doc);
    },
    remove_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      search_index.remove_note(vault_id, note_id);
      return Promise.resolve();
    },
    subscribe_index_progress() {
      return () => {};
    },
  };
}
