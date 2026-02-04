import { describe, it, expect } from 'vitest'
import { parse_search_query } from '$lib/utils/search_query_parser'

describe('parse_search_query', () => {
  it('parses path scope', () => {
    const result = parse_search_query('path: foo bar')
    expect(result.scope).toBe('path')
    expect(result.text).toBe('foo bar')
  })

  it('parses content scope without space', () => {
    const result = parse_search_query('content:foo')
    expect(result.scope).toBe('content')
    expect(result.text).toBe('foo')
  })

  it('defaults to all scope', () => {
    const result = parse_search_query('hello world')
    expect(result.scope).toBe('all')
    expect(result.text).toBe('hello world')
  })
})
