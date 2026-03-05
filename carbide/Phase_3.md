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

_(updated during implementation)_
