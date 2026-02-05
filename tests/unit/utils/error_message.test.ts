import { describe, it, expect } from 'vitest'
import { error_message } from '$lib/utils/error_message'

describe('error_message', () => {
  it('extracts message from Error instances', () => {
    expect(error_message(new Error('disk full'))).toBe('disk full')
    expect(error_message(new TypeError('invalid'))).toBe('invalid')
  })

  it('returns string errors as-is', () => {
    expect(error_message('something broke')).toBe('something broke')
  })

  it('returns fallback for unknown types', () => {
    expect(error_message(42)).toBe('Unknown error')
    expect(error_message(null)).toBe('Unknown error')
    expect(error_message(undefined)).toBe('Unknown error')
    expect(error_message({ code: 500 })).toBe('Unknown error')
  })
})
