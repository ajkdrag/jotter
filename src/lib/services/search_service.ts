import type { SearchPort } from "$lib/ports/search_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { CommandDefinition } from "$lib/types/command_palette";
import type { SettingDefinition } from "$lib/types/settings_registry";
import type {
  InFileMatch,
  OmnibarItem,
  PlannedLinkSuggestion,
  WikiSuggestion,
} from "$lib/types/search";
import type {
  SearchNotesResult,
  WikiSuggestionsResult,
  OmnibarSearchResult,
  CrossVaultSearchResult,
  CrossVaultSearchGroup,
} from "$lib/types/search_service_result";
import { parse_search_query } from "$lib/domain/search_query_parser";
import { search_within_text } from "$lib/domain/search_within_text";
import { COMMANDS_REGISTRY } from "$lib/domain/search_commands";
import { SETTINGS_REGISTRY } from "$lib/types/settings_registry";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";
import type { Vault } from "$lib/types/vault";

const log = create_logger("search_service");
const WIKI_SUGGEST_LIMIT = 15;
const WIKI_SUGGEST_EXISTING_RESERVE = 10;
const WIKI_SUGGEST_PLANNED_RESERVE = 5;
type CrossVaultSettledSearch = PromiseSettledResult<
  Awaited<ReturnType<SearchPort["search_notes"]>>
>;

type CrossVaultAggregation = {
  groups: CrossVaultSearchGroup[];
  first_error: string | null;
};

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

function merge_wiki_suggestions(input: {
  existing_suggestions: WikiSuggestion[];
  planned_targets: PlannedLinkSuggestion[];
}): WikiSuggestion[] {
  const existing = input.existing_suggestions.filter(
    (item): item is Extract<WikiSuggestion, { kind: "existing" }> =>
      item.kind === "existing",
  );
  const existing_paths = new Set(
    existing.map((item) => String(item.note.path).toLowerCase()),
  );

  const planned = [...input.planned_targets]
    .sort((left, right) => {
      if (right.ref_count !== left.ref_count) {
        return right.ref_count - left.ref_count;
      }
      return left.target_path.localeCompare(right.target_path);
    })
    .filter((item) => !existing_paths.has(item.target_path.toLowerCase()))
    .map((item) => ({
      kind: "planned" as const,
      target_path: item.target_path,
      ref_count: item.ref_count,
      score: item.ref_count,
    }));

  if (existing.length === 0) {
    return planned.slice(0, WIKI_SUGGEST_LIMIT);
  }
  if (planned.length === 0) {
    return existing.slice(0, WIKI_SUGGEST_LIMIT);
  }

  const existing_reserved = Math.min(
    existing.length,
    WIKI_SUGGEST_EXISTING_RESERVE,
  );
  const planned_reserved = Math.min(
    planned.length,
    WIKI_SUGGEST_PLANNED_RESERVE,
  );

  let merged: WikiSuggestion[] = [
    ...existing.slice(0, existing_reserved),
    ...planned.slice(0, planned_reserved),
  ];
  let remaining = WIKI_SUGGEST_LIMIT - merged.length;

  if (remaining > 0) {
    const existing_extra = existing.slice(
      existing_reserved,
      existing_reserved + remaining,
    );
    merged = [...merged, ...existing_extra];
    remaining = WIKI_SUGGEST_LIMIT - merged.length;
  }

  if (remaining > 0) {
    const planned_extra = planned.slice(
      planned_reserved,
      planned_reserved + remaining,
    );
    merged = [...merged, ...planned_extra];
  }

  return merged.slice(0, WIKI_SUGGEST_LIMIT);
}

export class SearchService {
  private active_search_revision = 0;
  private active_wiki_suggest_revision = 0;
  private active_cross_vault_search_revision = 0;

  constructor(
    private readonly search_port: SearchPort,
    private readonly vault_store: VaultStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  private list_searchable_vaults(): Vault[] {
    const ordered_vaults: Vault[] = [];
    const seen_ids = new Set<string>();

    for (const vault of this.vault_store.recent_vaults) {
      if (vault.is_available === false) {
        continue;
      }
      const key = String(vault.id);
      if (seen_ids.has(key)) {
        continue;
      }
      seen_ids.add(key);
      ordered_vaults.push(vault);
    }

    const active_vault = this.vault_store.vault;
    if (active_vault && active_vault.is_available !== false) {
      const key = String(active_vault.id);
      if (!seen_ids.has(key)) {
        ordered_vaults.unshift(active_vault);
      }
    }

    return ordered_vaults;
  }

  async search_notes(query: string): Promise<SearchNotesResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.op_store.reset("search.notes");
      return { status: "empty", results: [] };
    }

    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      this.op_store.reset("search.notes");
      return { status: "skipped", results: [] };
    }

    const revision = ++this.active_search_revision;
    this.op_store.start("search.notes", this.now_ms());

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
      log.error("Search failed", { error: message });
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
      const [existing_suggestions, planned_targets] = await Promise.all([
        this.search_port.suggest_wiki_links(
          vault_id,
          trimmed,
          WIKI_SUGGEST_LIMIT,
        ),
        this.search_port.suggest_planned_links(
          vault_id,
          trimmed,
          WIKI_SUGGEST_LIMIT,
        ),
      ]);
      if (revision !== this.active_wiki_suggest_revision) {
        return { status: "stale", results: [] };
      }
      const results = merge_wiki_suggestions({
        existing_suggestions,
        planned_targets,
      });
      return { status: "success", results };
    } catch (error) {
      if (revision !== this.active_wiki_suggest_revision) {
        return { status: "stale", results: [] };
      }
      const message = error_message(error);
      log.error("Wiki suggest failed", { error: message });
      return { status: "failed", error: message, results: [] };
    }
  }

  async search_notes_all_vaults(
    query: string,
  ): Promise<CrossVaultSearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.op_store.reset("search.notes.all_vaults");
      return { status: "empty", groups: [] };
    }

    const searchable_vaults = this.list_searchable_vaults();
    if (searchable_vaults.length === 0) {
      this.op_store.reset("search.notes.all_vaults");
      return { status: "skipped", groups: [] };
    }

    const revision = ++this.active_cross_vault_search_revision;
    this.op_store.start("search.notes.all_vaults", this.now_ms());

    try {
      const settled = await this.run_cross_vault_search(
        searchable_vaults,
        query,
      );
      if (this.is_cross_vault_search_stale(revision)) {
        return { status: "stale", groups: [] };
      }

      const { groups, first_error } = this.aggregate_cross_vault_search_results(
        searchable_vaults,
        settled,
      );

      if (groups.length === 0 && first_error) {
        this.op_store.fail("search.notes.all_vaults", first_error);
        return { status: "failed", error: first_error, groups: [] };
      }

      this.op_store.succeed("search.notes.all_vaults");
      return { status: "success", groups };
    } catch (error) {
      if (this.is_cross_vault_search_stale(revision)) {
        return { status: "stale", groups: [] };
      }

      const message = error_message(error);
      log.error("Cross-vault search failed", { error: message });
      this.op_store.fail("search.notes.all_vaults", message);
      return { status: "failed", error: message, groups: [] };
    }
  }

  private is_cross_vault_search_stale(revision: number): boolean {
    return revision !== this.active_cross_vault_search_revision;
  }

  private parse_notes_domain_query(query: string) {
    const parsed = parse_search_query(query);
    return {
      ...parsed,
      domain: "notes" as const,
    };
  }

  private async run_cross_vault_search(
    searchable_vaults: Vault[],
    query: string,
  ): Promise<CrossVaultSettledSearch[]> {
    const parsed_query = this.parse_notes_domain_query(query);
    return await Promise.allSettled(
      searchable_vaults.map((vault) =>
        this.search_port.search_notes(vault.id, parsed_query, 20),
      ),
    );
  }

  private aggregate_cross_vault_search_results(
    searchable_vaults: Vault[],
    settled: CrossVaultSettledSearch[],
  ): CrossVaultAggregation {
    const groups: CrossVaultSearchGroup[] = [];
    let first_error: string | null = null;

    for (let index = 0; index < settled.length; index += 1) {
      const result = settled[index];
      const vault = searchable_vaults[index];
      if (!vault || !result) {
        continue;
      }

      if (result.status === "rejected") {
        const message = error_message(result.reason);
        if (!first_error) {
          first_error = message;
        }
        log.error("Cross-vault search failed", {
          vault_name: vault.name,
          error: message,
        });
        continue;
      }

      if (result.value.length === 0) {
        continue;
      }

      groups.push({
        vault_id: vault.id,
        vault_name: vault.name,
        vault_path: vault.path,
        vault_note_count: vault.note_count ?? null,
        vault_last_opened_at: vault.last_opened_at ?? null,
        vault_is_available: vault.is_available !== false,
        results: result.value,
      });
    }

    return {
      groups,
      first_error,
    };
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

    if (parsed.domain === "planned") {
      if (!parsed.text.trim()) {
        return { domain: "planned", items: [] };
      }
      const vault_id = this.vault_store.vault?.id;
      if (!vault_id) {
        return { domain: "planned", items: [] };
      }
      try {
        const suggestions = await this.search_port.suggest_planned_links(
          vault_id,
          parsed.text,
          50,
        );
        const items: OmnibarItem[] = suggestions.map((item) => ({
          kind: "planned_note" as const,
          target_path: item.target_path,
          ref_count: item.ref_count,
          score: item.ref_count,
        }));
        return { domain: "planned", items };
      } catch (error) {
        const message = error_message(error);
        log.error("Planned-note search failed", { error: message });
        return { domain: "planned", items: [], status: "failed" };
      }
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

  reset_search_notes_operation() {
    this.op_store.reset("search.notes");
    this.op_store.reset("search.notes.all_vaults");
  }

  async resolve_note_link(
    source_path: string,
    raw_target: string,
  ): Promise<string | null> {
    return this.search_port.resolve_note_link(source_path, raw_target);
  }
}
