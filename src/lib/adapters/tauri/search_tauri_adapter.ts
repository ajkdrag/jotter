import type {
  LocalNoteLinksSnapshot,
  NoteLinksSnapshot,
  RewriteResult,
  SearchPort,
} from "$lib/ports/search_port";
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

type TauriExternalLink = {
  url: string;
  text: string;
};

type TauriLocalLinksSnapshot = {
  outlink_paths: string[];
  external_links: TauriExternalLink[];
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

function map_existing_wiki_suggestions(
  hits: TauriSuggestionHit[],
): WikiSuggestion[] {
  return hits.map((hit) => ({
    kind: "existing" as const,
    note: to_note_meta(hit.note),
    score: hit.score,
  }));
}

function map_planned_link_suggestions(
  hits: TauriPlannedSuggestionHit[],
): PlannedLinkSuggestion[] {
  return hits.map((hit) => ({
    target_path: hit.target_path,
    ref_count: hit.ref_count,
  }));
}

function map_note_links_snapshot(
  snapshot: TauriLinksSnapshot,
): NoteLinksSnapshot {
  return {
    backlinks: snapshot.backlinks.map(to_note_meta),
    outlinks: snapshot.outlinks.map(to_note_meta),
    orphan_links: snapshot.orphan_links.map((orphan) => ({
      target_path: orphan.target_path,
      ref_count: orphan.ref_count,
    })),
  };
}

function map_local_note_links_snapshot(
  snapshot: TauriLocalLinksSnapshot,
): LocalNoteLinksSnapshot {
  return {
    outlink_paths: snapshot.outlink_paths,
    external_links: snapshot.external_links.map((link) => ({
      url: link.url,
      text: link.text,
    })),
  };
}

export function create_search_tauri_adapter(): SearchPort {
  const invoke_search = <Result>(
    command: string,
    payload: Record<string, unknown>,
  ) => tauri_invoke<Result>(command, payload);

  return {
    async search_notes(
      vault_id: VaultId,
      query: SearchQuery,
      limit = 50,
    ): Promise<NoteSearchHit[]> {
      const hits = await invoke_search<TauriSearchHit[]>("index_search", {
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
      const hits = await invoke_search<TauriSuggestionHit[]>("index_suggest", {
        vaultId: vault_id,
        query,
        limit,
      });
      return map_existing_wiki_suggestions(hits);
    },

    async suggest_planned_links(
      vault_id: VaultId,
      query: string,
      limit = 15,
    ): Promise<PlannedLinkSuggestion[]> {
      const hits = await invoke_search<TauriPlannedSuggestionHit[]>(
        "index_suggest_planned",
        {
          vaultId: vault_id,
          query,
          limit,
        },
      );
      return map_planned_link_suggestions(hits);
    },

    async get_note_links_snapshot(
      vault_id: VaultId,
      note_path: string,
    ): Promise<NoteLinksSnapshot> {
      const snapshot = await invoke_search<TauriLinksSnapshot>(
        "index_note_links_snapshot",
        {
          vaultId: vault_id,
          noteId: note_path,
        },
      );
      return map_note_links_snapshot(snapshot);
    },

    async extract_local_note_links(
      vault_id: VaultId,
      note_path: string,
      markdown: string,
    ): Promise<LocalNoteLinksSnapshot> {
      const snapshot = await invoke_search<TauriLocalLinksSnapshot>(
        "index_extract_local_note_links",
        {
          vaultId: vault_id,
          noteId: note_path,
          markdown,
        },
      );
      return map_local_note_links_snapshot(snapshot);
    },

    async rewrite_note_links(
      markdown: string,
      old_source_path: string,
      new_source_path: string,
      target_map: Record<string, string>,
    ): Promise<RewriteResult> {
      return invoke_search<RewriteResult>("rewrite_note_links", {
        markdown,
        oldSourcePath: old_source_path,
        newSourcePath: new_source_path,
        targetMap: target_map,
      });
    },

    async resolve_note_link(
      source_path: string,
      raw_target: string,
    ): Promise<string | null> {
      return invoke_search<string | null>("resolve_note_link", {
        sourcePath: source_path,
        rawTarget: raw_target,
      });
    },
  };
}
