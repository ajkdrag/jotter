import type { SearchPort } from '$lib/ports/search_port'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { SearchNotesResult } from '$lib/types/search_service_result'
import { parse_search_query } from '$lib/utils/search_query_parser'
import { logger } from '$lib/utils/logger'

export class SearchService {
  private active_search_revision = 0

  constructor(
    private readonly search_port: SearchPort,
    private readonly vault_store: VaultStore,
    private readonly op_store: OpStore
  ) {}

  async search_notes(query: string): Promise<SearchNotesResult> {
    const trimmed = query.trim()
    if (!trimmed) {
      this.op_store.reset('search.notes')
      return {
        status: 'empty',
        results: []
      }
    }

    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return {
        status: 'skipped',
        results: []
      }
    }

    const revision = ++this.active_search_revision
    this.op_store.start('search.notes')

    try {
      const results = await this.search_port.search_notes(vault_id, parse_search_query(query), 20)
      if (revision !== this.active_search_revision) {
        return {
          status: 'stale',
          results: []
        }
      }

      this.op_store.succeed('search.notes')
      return {
        status: 'success',
        results
      }
    } catch (error) {
      if (revision !== this.active_search_revision) {
        return {
          status: 'stale',
          results: []
        }
      }

      const message = 'Search failed'
      logger.error(`Search failed: ${String(error)}`)
      this.op_store.fail('search.notes', message)
      return {
        status: 'failed',
        error: message,
        results: []
      }
    }
  }
}
