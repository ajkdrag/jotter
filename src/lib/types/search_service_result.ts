import type {
  NoteSearchHit,
  WikiSuggestion,
  OmnibarItem,
} from "$lib/types/search";

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
