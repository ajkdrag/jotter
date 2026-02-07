import type { ClipboardPort } from '$lib/ports/clipboard_port'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import { error_message } from '$lib/utils/error_message'

export class ClipboardService {
  constructor(
    private readonly clipboard_port: ClipboardPort,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore
  ) {}

  async copy_open_note_markdown(): Promise<void> {
    const markdown = this.editor_store.open_note?.markdown
    if (!markdown) return

    this.op_store.start('clipboard.write')

    try {
      await this.clipboard_port.write_text(markdown)
      this.op_store.succeed('clipboard.write')
    } catch (error) {
      this.op_store.fail('clipboard.write', error_message(error))
      throw error
    }
  }

  async copy_text(text: string): Promise<void> {
    if (!text) return

    this.op_store.start('clipboard.write')

    try {
      await this.clipboard_port.write_text(text)
      this.op_store.succeed('clipboard.write')
    } catch (error) {
      this.op_store.fail('clipboard.write', error_message(error))
      throw error
    }
  }
}
