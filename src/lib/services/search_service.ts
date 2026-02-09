import type { SearchPort } from "$lib/ports/search_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { CommandDefinition } from "$lib/types/command_palette";
import type { SettingDefinition } from "$lib/types/settings_registry";
import type { InFileMatch, OmnibarItem } from "$lib/types/search";
import type {
  SearchNotesResult,
  WikiSuggestionsResult,
  OmnibarSearchResult,
} from "$lib/types/search_service_result";
import { parse_search_query } from "$lib/utils/search_query_parser";
import { search_within_text } from "$lib/utils/search_within_text";
import { COMMANDS_REGISTRY } from "$lib/utils/search_commands";
import { SETTINGS_REGISTRY } from "$lib/types/settings_registry";
import { error_message } from "$lib/utils/error_message";
import { logger } from "$lib/utils/logger";

function score_command(query: string, command: CommandDefinition): number {
  const label = command.label.toLowerCase();
  if (label.startsWith(query)) return 100;
  if (label.includes(query)) return 80;
  if (command.keywords.some((k) => k.toLowerCase().includes(query))) return 60;
  if (command.description.toLowerCase().includes(query)) return 40;
  return 0;
}

function score_setting(query: string, setting: SettingDefinition): number {
  const label = setting.label.toLowerCase();
  if (label.startsWith(query)) return 100;
  if (label.includes(query)) return 80;
  if (setting.keywords.some((k) => k.toLowerCase().includes(query))) return 60;
  if (setting.description.toLowerCase().includes(query)) return 40;
  if (setting.category.toLowerCase().includes(query)) return 20;
  return 0;
}

export class SearchService {
  private active_search_revision = 0;
  private active_wiki_suggest_revision = 0;

  constructor(
    private readonly search_port: SearchPort,
    private readonly vault_store: VaultStore,
    private readonly op_store: OpStore,
  ) {}

  async search_notes(query: string): Promise<SearchNotesResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.op_store.reset("search.notes");
      return { status: "empty", results: [] };
    }

    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped", results: [] };
    }

    const revision = ++this.active_search_revision;
    this.op_store.start("search.notes");

    try {
      const results = await this.search_port.search_notes(
        vault_id,
        parse_search_query(query),
        20,
      );
      if (revision !== this.active_search_revision) {
        return { status: "stale", results: [] };
      }

      this.op_store.succeed("search.notes");
      return { status: "success", results };
    } catch (error) {
      if (revision !== this.active_search_revision) {
        return { status: "stale", results: [] };
      }

      const message = error_message(error);
      logger.error(`Search failed: ${message}`);
      this.op_store.fail("search.notes", message);
      return { status: "failed", error: message, results: [] };
    }
  }

  async suggest_wiki_links(query: string): Promise<WikiSuggestionsResult> {
    const revision = ++this.active_wiki_suggest_revision;
    const trimmed = query.trim();
    if (!trimmed) return { status: "empty", results: [] };

    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) return { status: "skipped", results: [] };

    try {
      const results = await this.search_port.suggest_wiki_links(
        vault_id,
        trimmed,
        15,
      );
      if (revision !== this.active_wiki_suggest_revision) {
        return { status: "stale", results: [] };
      }
      return { status: "success", results };
    } catch (error) {
      if (revision !== this.active_wiki_suggest_revision) {
        return { status: "stale", results: [] };
      }
      const message = error_message(error);
      logger.error(`Wiki suggest failed: ${message}`);
      return { status: "failed", error: message, results: [] };
    }
  }

  search_commands(query: string): OmnibarItem[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return COMMANDS_REGISTRY.map((command) => ({
        kind: "command" as const,
        command,
        score: 0,
      }));
    }

    return COMMANDS_REGISTRY.map((command) => ({
      kind: "command" as const,
      command,
      score: score_command(q, command),
    }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  search_settings(query: string): OmnibarItem[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    return SETTINGS_REGISTRY.map((setting) => ({
      kind: "setting" as const,
      setting,
      score: score_setting(q, setting),
    }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  search_within_file(text: string, query: string): InFileMatch[] {
    return search_within_text(text, query);
  }

  async search_omnibar(raw_query: string): Promise<OmnibarSearchResult> {
    const parsed = parse_search_query(raw_query);

    if (parsed.domain === "commands") {
      const items = [
        ...this.search_commands(parsed.text),
        ...this.search_settings(parsed.text),
      ];
      return { domain: "commands", items };
    }

    const result = await this.search_notes(raw_query);
    const items: OmnibarItem[] = result.results.map((r) => ({
      kind: "note" as const,
      note: r.note,
      score: r.score,
      snippet: r.snippet,
    }));
    return { domain: "notes", items, status: result.status };
  }
}
