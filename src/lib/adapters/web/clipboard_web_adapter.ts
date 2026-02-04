import type { ClipboardPort } from '$lib/ports/clipboard_port'

type ClipboardLike = {
  writeText: (text: string) => Promise<void>
}

export function create_clipboard_web_adapter(input?: { clipboard?: ClipboardLike }): ClipboardPort {
  const clipboard = input?.clipboard ?? navigator.clipboard

  return {
    async write_text(text) {
      await clipboard.writeText(text)
    }
  }
}

