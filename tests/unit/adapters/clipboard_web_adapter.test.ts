import { describe, it, expect, vi } from 'vitest'
import { create_clipboard_web_adapter } from '$lib/adapters/web/clipboard_web_adapter'

describe('create_clipboard_web_adapter', () => {
  it('writes text to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const adapter = create_clipboard_web_adapter({ clipboard: { writeText } })

    await adapter.write_text('hello')

    expect(writeText).toHaveBeenCalledWith('hello')
  })
})

