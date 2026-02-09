import { describe, expect, it, vi } from "vitest";
import type {
  EditorPort,
  EditorSession,
  EditorSessionConfig,
} from "$lib/ports/editor_port";
import {
  EditorService,
  type EditorServiceCallbacks,
} from "$lib/services/editor_service";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import type { OpenNoteState, CursorInfo } from "$lib/types/editor";
import { as_markdown_text, as_note_path } from "$lib/types/ids";
import { create_test_vault } from "../helpers/test_fixtures";

function create_open_note(note_path: string, markdown: string): OpenNoteState {
  const path = as_note_path(note_path);
  return {
    meta: {
      id: path,
      path,
      title: note_path.replace(/\.md$/i, ""),
      mtime_ms: 0,
      size_bytes: markdown.length,
    },
    markdown: as_markdown_text(markdown),
    buffer_id: path,
    is_dirty: false,
  };
}

function create_session(initial_markdown: string): EditorSession {
  let current_markdown = initial_markdown;
  return {
    destroy: vi.fn(),
    set_markdown: vi.fn((markdown: string) => {
      current_markdown = markdown;
    }),
    get_markdown: vi.fn(() => current_markdown),
    insert_text_at_cursor: vi.fn(),
    mark_clean: vi.fn(),
    is_dirty: vi.fn(() => false),
    focus: vi.fn(),
  };
}

function create_deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function create_setup(
  start_session: (config: EditorSessionConfig) => Promise<EditorSession>,
) {
  const editor_store = new EditorStore();
  const vault_store = new VaultStore();
  const op_store = new OpStore();
  vault_store.set_vault(create_test_vault());

  const session_configs: EditorSessionConfig[] = [];
  const start_session_mock = vi.fn((config: EditorSessionConfig) => {
    session_configs.push(config);
    return start_session(config);
  });

  const editor_port: EditorPort = {
    start_session: start_session_mock,
  };

  const callbacks: EditorServiceCallbacks = {
    on_internal_link_click: vi.fn(),
    on_image_paste_requested: vi.fn(),
  };

  const service = new EditorService(
    editor_port,
    vault_store,
    editor_store,
    op_store,
    callbacks,
  );

  return {
    service,
    editor_store,
    op_store,
    callbacks,
    start_session: start_session_mock,
    session_configs,
  };
}

function session_config_at(
  session_configs: EditorSessionConfig[],
  index: number,
): EditorSessionConfig {
  const config = session_configs[index];
  if (!config) {
    throw new Error(`Missing start_session config at index ${String(index)}`);
  }
  return config;
}

describe("EditorService", () => {
  it("mounts and opens buffers with session configs and hooks", async () => {
    const first_session = create_session("alpha");
    const second_session = create_session("beta");
    let invocation = 0;
    const { service, editor_store, start_session, session_configs } =
      create_setup(() => {
        invocation += 1;
        return Promise.resolve(
          invocation === 1 ? first_session : second_session,
        );
      });
    const root = {} as HTMLDivElement;
    const first_note = create_open_note("docs/alpha.md", "# Alpha");
    const second_note = create_open_note("docs/beta.md", "# Beta");

    editor_store.set_open_note(first_note);
    await service.mount({
      root,
      note: first_note,
      link_syntax: "wikilink",
    });

    editor_store.set_open_note(second_note);
    await service.open_buffer(second_note, "markdown");

    expect(start_session).toHaveBeenCalledTimes(2);
    expect(first_session.destroy).toHaveBeenCalledTimes(1);

    const first_call = session_config_at(session_configs, 0);
    expect(first_call.root).toBe(root);
    expect(first_call.initial_markdown).toBe("# Alpha");
    expect(first_call.note_path).toBe(as_note_path("docs/alpha.md"));
    expect(first_call.vault_id).toBe(create_test_vault().id);
    expect(first_call.link_syntax).toBe("wikilink");
    expect(typeof first_call.events.on_markdown_change).toBe("function");
    expect(typeof first_call.events.on_dirty_state_change).toBe("function");
    expect(typeof first_call.events.on_cursor_change).toBe("function");
    expect(typeof first_call.events.on_internal_link_click).toBe("function");
    expect(typeof first_call.events.on_image_paste_requested).toBe("function");

    const second_call = session_config_at(session_configs, 1);
    expect(second_call.initial_markdown).toBe("# Beta");
    expect(second_call.note_path).toBe(as_note_path("docs/beta.md"));
    expect(second_call.link_syntax).toBe("markdown");
  });

  it("applies markdown updates only for active session generation", async () => {
    const first_session = create_session("alpha");
    const second_session = create_session("beta");
    let invocation = 0;
    const { service, editor_store, session_configs } = create_setup(() => {
      invocation += 1;
      return Promise.resolve(invocation === 1 ? first_session : second_session);
    });
    const root = {} as HTMLDivElement;
    const first_note = create_open_note("docs/alpha.md", "# Alpha");
    const second_note = create_open_note("docs/beta.md", "# Beta");

    editor_store.set_open_note(first_note);
    await service.mount({
      root,
      note: first_note,
      link_syntax: "wikilink",
    });

    editor_store.set_open_note(second_note);
    await service.open_buffer(second_note, "wikilink");

    const first_events = session_config_at(session_configs, 0).events;
    const second_events = session_config_at(session_configs, 1).events;

    first_events.on_markdown_change("# stale");
    expect(editor_store.open_note?.markdown).toBe(as_markdown_text("# Beta"));

    second_events.on_markdown_change("# updated");
    expect(editor_store.open_note?.markdown).toBe(
      as_markdown_text("# updated"),
    );
  });

  it("updates dirty state from session events", async () => {
    const session = create_session("alpha");
    const { service, editor_store, session_configs } = create_setup(() =>
      Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    await service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    const events = session_config_at(session_configs, 0).events;
    events.on_dirty_state_change(true);

    expect(editor_store.open_note?.is_dirty).toBe(true);
  });

  it("updates cursor state from session events", async () => {
    const session = create_session("alpha");
    const { service, editor_store, session_configs } = create_setup(() =>
      Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");
    const cursor: CursorInfo = { line: 3, column: 8, total_lines: 12 };

    editor_store.set_open_note(note);
    await service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    const events = session_config_at(session_configs, 0).events;
    events.on_cursor_change?.(cursor);

    expect(editor_store.cursor).toEqual(cursor);
  });

  it("dispatches internal link click via callbacks", async () => {
    const session = create_session("alpha");
    const { service, editor_store, callbacks, session_configs } = create_setup(
      () => Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    await service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    const events = session_config_at(session_configs, 0).events;
    events.on_internal_link_click?.("docs/next.md");

    expect(callbacks.on_internal_link_click).toHaveBeenCalledWith(
      "docs/next.md",
    );
  });

  it("dispatches image paste via callbacks", async () => {
    const session = create_session("alpha");
    const { service, editor_store, callbacks, session_configs } = create_setup(
      () => Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    await service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    const image = {
      bytes: new Uint8Array([1, 2, 3]),
      mime_type: "image/png",
      file_name: "pasted.png",
    };
    const events = session_config_at(session_configs, 0).events;
    events.on_image_paste_requested?.(image);

    expect(callbacks.on_image_paste_requested).toHaveBeenCalledWith(
      as_note_path("docs/alpha.md"),
      as_note_path("docs/alpha.md"),
      image,
    );
  });

  it("recreates sessions on note switch and ignores stale events", async () => {
    const first_session = create_session("alpha");
    const second_session = create_session("beta");
    let invocation = 0;
    const { service, editor_store, session_configs } = create_setup(() => {
      invocation += 1;
      return Promise.resolve(invocation === 1 ? first_session : second_session);
    });
    const root = {} as HTMLDivElement;
    const first_note = create_open_note("docs/alpha.md", "# Alpha");
    const second_note = create_open_note("docs/beta.md", "# Beta");

    editor_store.set_open_note(first_note);
    await service.mount({
      root,
      note: first_note,
      link_syntax: "wikilink",
    });

    editor_store.set_open_note(second_note);
    await service.open_buffer(second_note, "wikilink");

    const first_events = session_config_at(session_configs, 0).events;
    const second_events = session_config_at(session_configs, 1).events;

    first_events.on_dirty_state_change(true);
    expect(editor_store.open_note?.is_dirty).toBe(false);

    second_events.on_dirty_state_change(true);
    expect(editor_store.open_note?.is_dirty).toBe(true);
  });

  it("does not leak a late session when unmounted during startup", async () => {
    const deferred = create_deferred<EditorSession>();
    const late_session = create_session("alpha");
    const { service, editor_store } = create_setup(() => deferred.promise);
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    const mount_promise = service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    service.unmount();
    deferred.resolve(late_session);
    await mount_promise;

    expect(late_session.destroy).toHaveBeenCalledTimes(1);
    expect(service.is_mounted()).toBe(false);
  });

  it("flushes session markdown and syncs editor store", async () => {
    const session = create_session("# Original");
    const { service, editor_store } = create_setup(() =>
      Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    await service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    session.set_markdown("# Flushed");
    const flushed = service.flush();

    expect(flushed).toEqual({
      note_id: as_note_path("docs/alpha.md"),
      markdown: as_markdown_text("# Flushed"),
    });
    expect(editor_store.open_note?.markdown).toBe(
      as_markdown_text("# Flushed"),
    );
  });

  it("forwards mark_clean to session and keeps state coherent", async () => {
    const session = create_session("alpha");
    const { service, editor_store, session_configs } = create_setup(() =>
      Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    editor_store.set_dirty(note.meta.id, true);

    await service.mount({
      root,
      note,
      link_syntax: "wikilink",
    });

    service.mark_clean();
    expect(session.mark_clean).toHaveBeenCalledTimes(1);
    expect(editor_store.open_note?.is_dirty).toBe(true);

    const events = session_config_at(session_configs, 0).events;
    events.on_dirty_state_change(false);
    expect(editor_store.open_note?.is_dirty).toBe(false);
  });

  it("tracks op_store status for mount and open_buffer", async () => {
    const session = create_session("alpha");
    const { service, editor_store, op_store } = create_setup(() =>
      Promise.resolve(session),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    await service.mount({ root, note, link_syntax: "wikilink" });
    expect(op_store.get("editor.mount").status).toBe("success");

    const second_note = create_open_note("docs/beta.md", "# Beta");
    editor_store.set_open_note(second_note);
    await service.open_buffer(second_note, "wikilink");
    expect(op_store.get("editor.open_buffer").status).toBe("success");
  });

  it("records op_store failure when mount throws", async () => {
    const { service, editor_store, op_store } = create_setup(() =>
      Promise.reject(new Error("boom")),
    );
    const root = {} as HTMLDivElement;
    const note = create_open_note("docs/alpha.md", "# Alpha");

    editor_store.set_open_note(note);
    await service.mount({ root, note, link_syntax: "wikilink" });

    expect(op_store.get("editor.mount").status).toBe("error");
    expect(op_store.get("editor.mount").error).toBe("boom");
  });
});
