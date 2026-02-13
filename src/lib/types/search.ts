import type { NoteMeta } from "$lib/types/note";
import type { CommandDefinition } from "$lib/types/command_palette";
import type { SettingDefinition } from "$lib/types/settings_registry";

export type SearchScope = "all" | "path" | "title" | "content";
export type SearchDomain = "notes" | "commands";
export type OmnibarScope = "current_vault" | "all_vaults";

export type SearchQuery = {
  raw: string;
  text: string;
  scope: SearchScope;
  domain: SearchDomain;
};

export type NoteSearchHit = {
  note: NoteMeta;
  score: number;
  snippet?: string | undefined;
};

export type WikiSuggestion = {
  note: NoteMeta;
  score: number;
};

export type InFileMatch = {
  line: number;
  column: number;
  length: number;
  context: string;
};

type IndexProgressMeta = {
  mode?: "smart" | "dumb";
  run_id?: number;
  queued_work_items?: number;
};

export type IndexProgressEvent =
  | ({ status: "started"; vault_id: string; total: number } & IndexProgressMeta)
  | ({
      status: "progress";
      vault_id: string;
      indexed: number;
      total: number;
    } & IndexProgressMeta)
  | ({
      status: "completed";
      vault_id: string;
      indexed: number;
      elapsed_ms: number;
    } & IndexProgressMeta)
  | ({ status: "failed"; vault_id: string; error: string } & IndexProgressMeta);

export type OmnibarItem =
  | {
      kind: "note";
      note: NoteMeta;
      score: number;
      snippet?: string | undefined;
    }
  | {
      kind: "cross_vault_note";
      note: NoteMeta;
      vault_id: string;
      vault_name: string;
      vault_note_count?: number | null;
      vault_last_opened_at?: number | null;
      vault_is_available?: boolean;
      score: number;
      snippet?: string | undefined;
    }
  | { kind: "command"; command: CommandDefinition; score: number }
  | { kind: "setting"; setting: SettingDefinition; score: number }
  | { kind: "recent_note"; note: NoteMeta };
