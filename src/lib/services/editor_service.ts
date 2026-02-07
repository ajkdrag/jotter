import type { EditorHandle, EditorPort } from '$lib/ports/editor_port'
import type { AssetsPort } from '$lib/ports/assets_port'
import type { OpenNoteState, CursorInfo } from '$lib/types/editor'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { AssetPath, MarkdownText, NoteId } from '$lib/types/ids'
import { as_markdown_text } from '$lib/types/ids'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import { error_message } from '$lib/utils/error_message'
import { logger } from '$lib/utils/logger'

export type EditorFlushResult = {
  note_id: NoteId
  markdown: MarkdownText
}

export class EditorService {
  private handle: EditorHandle | null = null
  private root: HTMLDivElement | null = null
  private current_note: OpenNoteState | null = null
  private current_link_syntax: EditorSettings['link_syntax'] = 'wikilink'
  private on_wiki_link_click: ((note_path: string) => void) | null = null

  constructor(
    private readonly editor_port: EditorPort,
    private readonly assets_port: AssetsPort,
    private readonly vault_store: VaultStore,
    private readonly editor_store: EditorStore
  ) {}

  set_wiki_link_handler(handler: (note_path: string) => void) {
    this.on_wiki_link_click = handler
  }

  is_mounted(): boolean {
    return this.root !== null && this.handle !== null
  }

  async mount(args: {
    root: HTMLDivElement
    note: OpenNoteState
    link_syntax: EditorSettings['link_syntax']
  }): Promise<void> {
    this.teardown_handle()

    this.root = args.root
    this.current_note = args.note
    this.current_link_syntax = args.link_syntax

    await this.create_handle(args.root, args.note, args.link_syntax)
    this.focus()
  }

  unmount() {
    this.teardown_handle()
    this.root = null
    this.current_note = null
  }

  async open_buffer(note: OpenNoteState, link_syntax: EditorSettings['link_syntax']): Promise<void> {
    this.current_note = note
    this.current_link_syntax = link_syntax

    if (!this.root) return

    await this.create_handle(this.root, note, link_syntax)
    this.focus()
  }

  async apply_settings(settings: EditorSettings): Promise<void> {
    this.current_link_syntax = settings.link_syntax
    if (!this.current_note || !this.root) return
    await this.create_handle(this.root, this.current_note, settings.link_syntax)
    this.focus()
  }

  insert_text(text: string) {
    this.handle?.insert_text_at_cursor(text)
  }

  mark_clean() {
    this.handle?.mark_clean()
  }

  flush(): EditorFlushResult | null {
    if (!this.handle || !this.current_note) return null

    const markdown = this.handle.get_markdown()
    const payload: EditorFlushResult = {
      note_id: this.current_note.meta.id,
      markdown: as_markdown_text(markdown)
    }

    this.editor_store.set_markdown(payload.note_id, payload.markdown)
    return payload
  }

  focus() {
    this.handle?.focus()
  }

  private async resolve_asset_url(asset_path: AssetPath): Promise<string> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      throw new Error('No active vault')
    }
    return this.assets_port.resolve_asset_url(vault_id, asset_path)
  }

  private async create_handle(
    root: HTMLDivElement,
    note: OpenNoteState,
    link_syntax: EditorSettings['link_syntax']
  ) {
    this.teardown_handle()

    this.handle = await this.editor_port.create_editor(root, {
      initial_markdown: note.markdown,
      note_path: note.meta.path,
      link_syntax,
      resolve_asset_url: (asset_path) => this.resolve_asset_url(asset_path),
      on_markdown_change: (markdown: string) => {
        const active_note = this.current_note
        if (!active_note) return
        this.editor_store.set_markdown(active_note.meta.id, as_markdown_text(markdown))
      },
      on_dirty_state_change: (is_dirty: boolean) => {
        const active_note = this.current_note
        if (!active_note) return
        this.editor_store.set_dirty(active_note.meta.id, is_dirty)
      },
      on_cursor_change: (cursor: CursorInfo) => {
        const active_note = this.current_note
        if (!active_note) return
        this.editor_store.set_cursor(active_note.meta.id, cursor)
      },
      on_wiki_link_click: (note_path: string) => {
        this.on_wiki_link_click?.(note_path)
      }
    })
  }

  private teardown_handle() {
    const current = this.handle
    if (!current) return
    try {
      current.destroy()
    } catch (error) {
      logger.error(`Editor teardown failed: ${error_message(error)}`)
    } finally {
      this.handle = null
    }
  }
}
