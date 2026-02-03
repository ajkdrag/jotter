import type { ClipboardPort } from '$lib/ports/clipboard_port'

export function create_test_clipboard_adapter(): ClipboardPort & { _calls: { write_text: string[] } } {
  const calls = { write_text: [] as string[] }

  return {
    _calls: calls,
    async write_text(text) {
      calls.write_text.push(text)
    }
  }
}
