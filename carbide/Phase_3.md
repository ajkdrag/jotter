# Phase 3: macOS Default App Registration + Document Split View

## Requirements

From project guide (Prompt 4):

1. **macOS Default App** — Register as handler for .md/.markdown/.mdx files, handle file-open events, resolve to vault + navigate
2. **Document Split View** — Cmd+\ to split editor, two independent editor instances, shared vault context

## Plan

### Part A: macOS Default App Registration

1. Add `fileAssociations` to `src-tauri/tauri.conf.json` for `.md`, `.markdown`, `.mdx`
2. Split Tauri `run()` into `build()` + `run()` to handle `RunEvent::Opened { urls }`
3. On file open: resolve file path against known vaults
4. Emit `file-open` event to frontend with `{ path, vault_id? }`
5. Frontend listener: if in known vault → switch vault + open file; else → prompt to add folder as vault
6. Handle initial launch with file arg via `std::env::args()`

### Part B: Document Split View

1. Create `SplitViewStore` — tracks split state, secondary note, active pane
2. Create `SplitEditorStore` — lightweight EditorStore for secondary pane
3. Create secondary `EditorService` instance (lazy, on split activation)
4. Modify `workspace_layout.svelte` — nested Resizable.PaneGroup in center when split active
5. Create `SplitNoteEditor` component backed by secondary EditorService
6. Actions: `split_view_toggle`, `split_view_open`, `split_view_close`
7. Hotkeys: `Cmd+\` toggle, `Cmd+W` close secondary

### Architecture Decisions

| Decision                              | Rationale                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Single tab bar + secondary pane       | Avoids massive tab system refactor. Primary pane = tab-driven, secondary = explicit "open to side"  |
| Second EditorService instance         | Clean separation. Same EditorPort (MilkdownAdapter), different stores. No singleton refactor needed |
| `RunEvent::Opened` for file events    | Tauri v2's built-in macOS file open event. No deep-link plugin needed                               |
| Prompt-to-add-vault for unknown files | Avoids "standalone mode" complexity. Current architecture assumes vault context                     |

## Development Log

### Part A: macOS Default App Registration — Complete

1. Added `fileAssociations` to `tauri.conf.json` for `.md`, `.markdown`, `.mdx`, `.txt`
2. Split `run()` → `build()` + `run()` with `RunEvent::Opened` handler in `src-tauri/src/app/mod.rs`
3. Added `resolve_file_to_vault` Tauri command in `src-tauri/src/features/vault/service.rs`
4. Created `file_open.reactor.svelte.ts` — thin callback reactor (no await, layering-compliant)
5. Added `app_handle_file_open` action in `app_actions.ts` — resolves file to vault, switches if needed, opens note
6. Wired through `VaultPort` → `vault_tauri_adapter.ts` → `VaultService`
7. All checks pass (lint, layering, type check, cargo check)

### Part B: Document Split View — Complete

1. Created `SplitViewStore` with Svelte 5 runes ($state) — tracks active, secondary_note, active_pane
2. Created `SplitViewService` — manages secondary EditorService + EditorStore lifecycle
   - Separate activation (store update) vs mount (DOM-dependent) to solve chicken-and-egg
3. Created `SplitNoteEditor.svelte` — header with title/close, content with `use:mount_editor` directive
4. Modified `workspace_layout.svelte` — conditional nested `Resizable.PaneGroup` when split active
5. Registered actions: toggle, close, mount, unmount, set_active_pane, open_to_side
6. Added `Cmd+\` hotkey in `default_hotkeys.ts`
7. Added "Open to Side" context menu items in:
   - File tree row (via `on_open_to_side` callback prop)
   - Tab bar (via `ACTION_IDS.split_view_open_to_side` action)
8. Added split view close on vault switch in `apply_opened_vault`
9. Exported `SplitNoteEditor` through barrel to fix cross-feature layering violation
10. Added 9 unit tests for `SplitViewStore`

### Key Decisions Made During Implementation

- **No separate SplitEditorStore class** — reused `EditorStore` directly. Same shape, no need for abstraction.
- **Reactor delegates to action** — file_open reactor just calls a callback; all async logic in the action handler. Keeps reactors layering-compliant (no await).
- **`void` dispatch for split_view_close on vault switch** — fire-and-forget since close is synchronous internally.
