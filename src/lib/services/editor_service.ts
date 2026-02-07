import type { EditorPort, EditorSession } from '$lib/ports/editor_port'
import type { OpenNoteState, CursorInfo, PastedImagePayload } from '$lib/types/editor'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { MarkdownText, NoteId } from '$lib/types/ids'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import { error_message } from '$lib/utils/error_message'
import { logger } from '$lib/utils/logger'

export type EditorFlushResult = {
  note_id: NoteId
  markdown: MarkdownText
}

export class EditorService {
  private session: EditorSession | null = null
  private host_root: HTMLDivElement | null = null
  private active_note: OpenNoteState | null = null
  private active_link_syntax: EditorSettings['link_syntax'] = 'wikilink'
  private session_generation = 0

  constructor(
    private readonly editor_port: EditorPort,
    private readonly vault_store: VaultStore,
    private readonly editor_store: EditorStore
  ) {}

  is_mounted(): boolean {
    return this.host_root !== null && this.session !== null
  }

  async mount(args: {
    root: HTMLDivElement
    note: OpenNoteState
    link_syntax: EditorSettings['link_syntax']
  }): Promise<void> {
    this.host_root = args.root
    this.active_note = args.note
    this.active_link_syntax = args.link_syntax

    await this.recreate_session()
    this.focus()
  }

  unmount() {
    this.invalidate_session_generation()
    this.teardown_session()
    this.host_root = null
    this.active_note = null
  }

  async open_buffer(note: OpenNoteState, link_syntax: EditorSettings['link_syntax']): Promise<void> {
    this.active_note = note
    this.active_link_syntax = link_syntax

    if (!this.host_root) return

    await this.recreate_session()
    this.focus()
  }

  insert_text(text: string) {
    this.session?.insert_text_at_cursor(text)
  }

  mark_clean() {
    this.session?.mark_clean()
  }

  flush(): EditorFlushResult | null {
    if (!this.session || !this.active_note) return null

    const markdown = this.session.get_markdown()
    const payload: EditorFlushResult = {
      note_id: this.active_note.meta.id,
      markdown: as_markdown_text(markdown)
    }

    this.editor_store.set_markdown(payload.note_id, payload.markdown)
    return payload
  }

  focus() {
    this.session?.focus()
  }

  private next_session_generation(): number {
    this.session_generation += 1
    return this.session_generation
  }

  private invalidate_session_generation() {
    this.session_generation += 1
  }

  private is_generation_current(generation: number): boolean {
    return generation === this.session_generation
  }

  private async recreate_session(): Promise<void> {
    const host_root = this.host_root
    const active_note = this.active_note
    if (!host_root || !active_note) return

    const generation = this.next_session_generation()
    const note_id = active_note.meta.id

    this.teardown_session()

    const next_session = await this.editor_port.start_session({
      root: host_root,
      initial_markdown: active_note.markdown,
      note_path: active_note.meta.path,
      vault_id: this.vault_store.vault?.id ?? null,
      link_syntax: this.active_link_syntax,
      events: {
        on_markdown_change: (markdown: string) => {
          if (!this.is_generation_current(generation)) return
          this.editor_store.set_markdown(note_id, as_markdown_text(markdown))
        },
        on_dirty_state_change: (is_dirty: boolean) => {
          if (!this.is_generation_current(generation)) return
          this.editor_store.set_dirty(note_id, is_dirty)
        },
        on_cursor_change: (cursor: CursorInfo) => {
          if (!this.is_generation_current(generation)) return
          this.editor_store.set_cursor(note_id, cursor)
        },
        on_internal_link_click: (note_path: string) => {
          if (!this.is_generation_current(generation)) return
          this.editor_store.emit_internal_link_click(as_note_path(note_path))
        },
        on_image_paste_requested: (image: PastedImagePayload) => {
          if (!this.is_generation_current(generation)) return
          this.editor_store.emit_image_paste_request(note_id, active_note.meta.path, image)
        }
      }
    })

    if (!this.is_generation_current(generation)) {
      this.destroy_session_instance(next_session)
      return
    }

    this.session = next_session
  }

  private teardown_session() {
    const current = this.session
    if (!current) return
    this.session = null
    this.destroy_session_instance(current)
  }

  private destroy_session_instance(session: EditorSession) {
    try {
      session.destroy()
    } catch (error) {
      logger.error(`Editor teardown failed: ${error_message(error)}`)
    }
  }
}
