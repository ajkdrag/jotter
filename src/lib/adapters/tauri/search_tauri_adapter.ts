import type { NoteLinksSnapshot, SearchPort } from "$lib/ports/search_port";
import type { VaultId, NoteId } from "$lib/types/ids";
import type {
  NoteSearchHit,
  PlannedLinkSuggestion,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";

type TauriNoteMeta = {
  id: string;
  path: string;
  title: string;
  name: string;
  mtime_ms: number;
  size_bytes: number;
};

type TauriSearchHit = {
  note: TauriNoteMeta;
  score: number;
  snippet: string | null;
};

type TauriSuggestionHit = {
  note: TauriNoteMeta;
  score: number;
};

type TauriPlannedSuggestionHit = {
  target_path: string;
  ref_count: number;
};

type TauriOrphanLink = {
  target_path: string;
  ref_count: number;
};

type TauriLinksSnapshot = {
  backlinks: TauriNoteMeta[];
  outlinks: TauriNoteMeta[];
  orphan_links: TauriOrphanLink[];
};

function to_note_meta(hit: TauriNoteMeta) {
  return {
    id: hit.id as NoteId,
    path: hit.path as NoteId,
    title: hit.title,
    name: hit.name,
    mtime_ms: hit.mtime_ms,
    size_bytes: hit.size_bytes,
  };
}

export function create_search_tauri_adapter(): SearchPort {
  return {
    async search_notes(
      vault_id: VaultId,
      query: SearchQuery,
      limit = 50,
    ): Promise<NoteSearchHit[]> {
      const hits = await tauri_invoke<TauriSearchHit[]>("index_search", {
        vaultId: vault_id,
        query,
      });
      return hits.slice(0, limit).map((hit) => ({
        note: to_note_meta(hit.note),
        score: hit.score,
        snippet: hit.snippet ?? undefined,
      }));
    },

    async suggest_wiki_links(
      vault_id: VaultId,
      query: string,
      limit = 15,
    ): Promise<WikiSuggestion[]> {
      const hits = await tauri_invoke<TauriSuggestionHit[]>("index_suggest", {
        vaultId: vault_id,
        query,
        limit,
      });
      return hits.map((hit) => ({
        kind: "existing" as const,
        note: to_note_meta(hit.note),
        score: hit.score,
      }));
    },

    async suggest_planned_links(
      vault_id: VaultId,
      query: string,
      limit = 15,
    ): Promise<PlannedLinkSuggestion[]> {
      const hits = await tauri_invoke<TauriPlannedSuggestionHit[]>(
        "index_suggest_planned",
        {
          vaultId: vault_id,
          query,
          limit,
        },
      );
      return hits.map((hit) => ({
        target_path: hit.target_path,
        ref_count: hit.ref_count,
      }));
    },

    async get_note_links_snapshot(
      vault_id: VaultId,
      note_path: string,
    ): Promise<NoteLinksSnapshot> {
      const snapshot = await tauri_invoke<TauriLinksSnapshot>(
        "index_note_links_snapshot",
        {
          vaultId: vault_id,
          noteId: note_path,
        },
      );
      return {
        backlinks: snapshot.backlinks.map(to_note_meta),
        outlinks: snapshot.outlinks.map(to_note_meta),
        orphan_links: snapshot.orphan_links.map((orphan) => ({
          target_path: orphan.target_path,
          ref_count: orphan.ref_count,
        })),
      };
    },
  };
}
