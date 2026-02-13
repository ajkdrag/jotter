import type { ClipboardPort } from "$lib/ports/clipboard_port";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("clipboard_service");

export class ClipboardService {
  constructor(
    private readonly clipboard_port: ClipboardPort,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  async copy_open_note_markdown(): Promise<void> {
    const markdown = this.editor_store.open_note?.markdown;
    if (!markdown) return;

    this.op_store.start("clipboard.write", this.now_ms());

    try {
      await this.clipboard_port.write_text(markdown);
      this.op_store.succeed("clipboard.write");
    } catch (error) {
      const message = error_message(error);
      log.error("Copy markdown failed", { error: message });
      this.op_store.fail("clipboard.write", message);
    }
  }
}
