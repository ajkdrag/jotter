import type {
  NoteSearchHit,
  WikiSuggestion,
  OmnibarItem,
} from "$lib/shared/types/search";
import type { VaultId, VaultPath } from "$lib/shared/types/ids";

export type SearchNotesResult =
  | {
      status: "success";
      results: NoteSearchHit[];
    }
  | {
      status: "empty";
      results: [];
    }
  | {
      status: "stale";
      results: [];
    }
  | {
      status: "skipped";
      results: [];
    }
  | {
      status: "failed";
      error: string;
      results: [];
    };

export type WikiSuggestionsResult =
  | { status: "success"; results: WikiSuggestion[] }
  | { status: "empty"; results: [] }
  | { status: "stale"; results: [] }
  | { status: "skipped"; results: [] }
  | { status: "failed"; error: string; results: [] };

export type OmnibarSearchResult = {
  domain: string;
  items: OmnibarItem[];
  status?: string;
};

export type CrossVaultSearchGroup = {
  vault_id: VaultId;
  vault_name: string;
  vault_path: VaultPath;
  vault_note_count: number | null;
  vault_last_opened_at: number | null;
  vault_is_available: boolean;
  results: NoteSearchHit[];
};

export type CrossVaultSearchResult =
  | {
      status: "success";
      groups: CrossVaultSearchGroup[];
    }
  | {
      status: "empty";
      groups: [];
    }
  | {
      status: "stale";
      groups: [];
    }
  | {
      status: "skipped";
      groups: [];
    }
  | {
      status: "failed";
      error: string;
      groups: [];
    };
