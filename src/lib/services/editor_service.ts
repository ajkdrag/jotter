import type { EditorPort, EditorSession } from "$lib/ports/editor_port";
import type {
  OpenNoteState,
  CursorInfo,
  PastedImagePayload,
} from "$lib/types/editor";
import type { EditorSettings } from "$lib/types/editor_settings";
import type { MarkdownText, NoteId, NotePath } from "$lib/types/ids";
import { as_markdown_text } from "$lib/types/ids";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { SearchService } from "$lib/services/search_service";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("editor_service");

export type EditorServiceCallbacks = {
  on_internal_link_click: (note_path: string) => void;
  on_external_link_click: (url: string) => void;
  on_image_paste_requested: (
    note_id: NoteId,
    note_path: NotePath,
    image: PastedImagePayload,
  ) => void;
};

type EditorFlushResult = {
  note_id: NoteId;
  markdown: MarkdownText;
};

export class EditorService {
  private session: EditorSession | null = null;
  private host_root: HTMLDivElement | null = null;
  private active_note: OpenNoteState | null = null;
  private active_link_syntax: EditorSettings["link_syntax"] = "wikilink";
  private session_generation = 0;

  constructor(
    private readonly editor_port: EditorPort,
    private readonly vault_store: VaultStore,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore,
    private readonly callbacks: EditorServiceCallbacks,
    private readonly search_service?: SearchService,
  ) {}

  is_mounted(): boolean {
    return this.host_root !== null && this.session !== null;
  }

  async mount(args: {
    root: HTMLDivElement;
    note: OpenNoteState;
    link_syntax: EditorSettings["link_syntax"];
  }): Promise<void> {
    this.host_root = args.root;
    this.active_note = args.note;
    this.active_link_syntax = args.link_syntax;

    this.op_store.start("editor.mount", Date.now());
    try {
      await this.recreate_session();
      this.focus();
      this.op_store.succeed("editor.mount");
    } catch (error) {
      log.error("Editor mount failed", { error });
      this.op_store.fail("editor.mount", error_message(error));
    }
  }

  unmount() {
    this.invalidate_session_generation();
    this.teardown_session();
    this.host_root = null;
    this.active_note = null;
  }

  open_buffer(
    note: OpenNoteState,
    link_syntax: EditorSettings["link_syntax"],
  ): void {
    this.active_note = note;
    this.active_link_syntax = link_syntax;

    if (!this.host_root || !this.session) return;

    this.session.open_buffer({
      note_path: note.meta.path,
      vault_id: this.vault_store.vault?.id ?? null,
      link_syntax,
      initial_markdown: note.markdown,
    });
    this.focus();
  }

  insert_text(text: string) {
    this.session?.insert_text_at_cursor(text);
  }

  mark_clean() {
    this.session?.mark_clean();
  }

  flush(): EditorFlushResult | null {
    if (!this.session || !this.active_note) return null;

    const markdown = this.session.get_markdown();
    const payload: EditorFlushResult = {
      note_id: this.active_note.meta.id,
      markdown: as_markdown_text(markdown),
    };

    this.editor_store.set_markdown(payload.note_id, payload.markdown);
    return payload;
  }

  focus() {
    this.session?.focus();
  }

  close_buffer(note_path: NotePath) {
    this.session?.close_buffer(note_path);
  }

  update_find_state(query: string, selected_index: number) {
    this.session?.update_find_state?.(query, selected_index);
  }

  private next_session_generation(): number {
    this.session_generation += 1;
    return this.session_generation;
  }

  private invalidate_session_generation() {
    this.session_generation += 1;
  }

  private is_generation_current(generation: number): boolean {
    return generation === this.session_generation;
  }

  private async recreate_session(): Promise<void> {
    const host_root = this.host_root;
    const active_note = this.active_note;
    if (!host_root || !active_note) return;

    const generation = this.next_session_generation();

    this.teardown_session();
    if (typeof host_root.replaceChildren === "function") {
      host_root.replaceChildren();
    }

    const get_active_note_id = () => this.active_note?.meta.id ?? null;
    const get_active_note_path = () => this.active_note?.meta.path ?? null;
    const with_active_note_id = (fn: (id: NoteId) => void) => {
      if (!this.is_generation_current(generation)) return;
      const id = get_active_note_id();
      if (!id) return;
      fn(id);
    };
    const with_active_note_identity = (
      fn: (id: NoteId, path: NotePath) => void,
    ) => {
      if (!this.is_generation_current(generation)) return;
      const id = get_active_note_id();
      const path = get_active_note_path();
      if (!id || !path) return;
      fn(id, path);
    };

    const next_session = await this.editor_port.start_session({
      root: host_root,
      initial_markdown: active_note.markdown,
      note_path: active_note.meta.path,
      vault_id: this.vault_store.vault?.id ?? null,
      link_syntax: this.active_link_syntax,
      events: {
        on_markdown_change: (markdown: string) => {
          with_active_note_id((id) => {
            this.editor_store.set_markdown(id, as_markdown_text(markdown));
          });
        },
        on_dirty_state_change: (is_dirty: boolean) => {
          with_active_note_id((id) => {
            this.editor_store.set_dirty(id, is_dirty);
          });
        },
        on_cursor_change: (cursor: CursorInfo) => {
          with_active_note_id((id) => {
            this.editor_store.set_cursor(id, cursor);
          });
        },
        on_internal_link_click: (note_path: string) => {
          if (!this.is_generation_current(generation)) return;
          this.callbacks.on_internal_link_click(note_path);
        },
        on_external_link_click: (url: string) => {
          if (!this.is_generation_current(generation)) return;
          this.callbacks.on_external_link_click(url);
        },
        on_image_paste_requested: (image: PastedImagePayload) => {
          with_active_note_identity((id, path) => {
            this.callbacks.on_image_paste_requested(id, path, image);
          });
        },
        ...(this.search_service
          ? {
              on_wiki_suggest_query: (query: string) => {
                if (!this.is_generation_current(generation)) return;
                void this.search_service
                  ?.suggest_wiki_links(query)
                  .then((result) => {
                    if (!this.is_generation_current(generation)) return;
                    if (result.status === "stale") return;

                    if (result.status !== "success") {
                      this.session?.set_wiki_suggestions?.([]);
                      return;
                    }

                    const items = result.results.map((r) => ({
                      title: r.note.name,
                      path: r.note.path,
                    }));
                    this.session?.set_wiki_suggestions?.(items);
                  });
              },
            }
          : {}),
      },
    });

    if (!this.is_generation_current(generation)) {
      this.destroy_session_instance(next_session);
      return;
    }

    this.session = next_session;
  }

  private teardown_session() {
    const current = this.session;
    if (!current) return;
    this.session = null;
    this.destroy_session_instance(current);
  }

  private destroy_session_instance(session: EditorSession) {
    try {
      session.destroy();
    } catch (error) {
      log.error("Editor teardown failed", { error });
    }
  }
}
