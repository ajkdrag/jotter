import { describe, it, expect } from 'vitest'
import { search_palette } from '$lib/operations/search_palette'
import { parse_search_query } from '$lib/utils/search_query_parser'
import { COMMANDS_REGISTRY } from '$lib/utils/search_commands'

describe('search_palette', () => {
  it('returns commands for empty query and no settings', () => {
    const result = search_palette({ query: parse_search_query('') })
    expect(result.commands).toEqual(COMMANDS_REGISTRY)
    expect(result.settings).toEqual([])
  })

  it('ranks label prefix matches highest', () => {
    const result = search_palette({ query: parse_search_query('set') })
    expect(result.commands[0]?.label).toBe('Settings')
  })

  it('returns settings only when query is non-empty', () => {
    const result = search_palette({ query: parse_search_query('font') })
    expect(result.settings.length).toBeGreaterThan(0)
  })
})
