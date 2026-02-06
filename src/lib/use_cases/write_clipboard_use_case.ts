import type { ClipboardPort } from '$lib/ports/clipboard_port'
import type { AppEvent } from '$lib/events/app_event'

export async function write_clipboard_use_case(
  ports: { clipboard: ClipboardPort },
  args: { text: string }
): Promise<AppEvent[]> {
  try {
    await ports.clipboard.write_text(args.text)
    return [{ type: 'clipboard_write_succeeded' }]
  } catch (error) {
    return [{ type: 'clipboard_write_failed', error: String(error) }]
  }
}
