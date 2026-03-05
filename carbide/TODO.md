# Carbide TODO Tracker

> Tracks implementation tasks for transforming Otterly into Carbide.
> Status: `[ ]` pending | `[~]` in progress | `[x]` done | `[-]` dropped

---

## Phase 0: Audit & Bootstrap

- [x] Audit Otterly codebase (architecture, commands, stores, components)
- [ ] Produce `carbide/AUDIT.md` (formal write-up of audit findings)
- [ ] Produce `carbide/ARCHITECTURE.md` (integration plan for all new features)
- [ ] Verify `cargo tauri dev` builds and runs cleanly
- [ ] Rebrand: app name, window title, asset URI scheme, config paths

---

## Phase 1: Vault Switcher (Dropdown)

> Start with Moraya-style dropdown vault switching. Otterly already has vault switching
> logic; this phase improves the UX with a quick-access dropdown in the sidebar header.
> Simultaneous multi-vault sidebar (VS Code-style) is deferred to a future enhancement.

### Frontend — UI

- [ ] Add vault dropdown selector in sidebar header (shows current vault name + chevron)
- [ ] Dropdown lists all known vaults, sorted by pinned-first then recent
- [ ] Click vault in dropdown → switch to that vault (uses existing `VaultService.switch_vault()`)
- [ ] "Add Vault" option at bottom of dropdown → opens folder picker
- [ ] "Manage Vaults" option → opens existing vault management dialog
- [ ] Show vault icon/emoji or first letter as visual identifier
- [ ] Right-click vault in dropdown → Remove from list, Reveal in Finder

### Frontend — Polish

- [ ] Keyboard shortcut to open vault switcher dropdown (e.g. `Cmd+Shift+V`)
- [ ] Show git branch + dirty indicator per vault in dropdown (if available)
- [ ] Persist last-used vault order

### Testing

- [ ] Test dropdown rendering with multiple vaults
- [ ] Test vault switching via dropdown
- [ ] Test "Add Vault" flow from dropdown

### Future: Simultaneous Multi-Vault Sidebar

- [ ] (Deferred) Refactor to show all open vaults as collapsible root nodes in sidebar
- [ ] (Deferred) Independent file watchers, search indices, git state per vault
- [ ] (Deferred) Cross-vault search scoping

---

## Phase 2: Outline View

### Frontend

- [x] Create `OutlinePanel.svelte` — heading hierarchy from ProseMirror doc state
- [x] Extract headings from Milkdown's ProseMirror state (h1–h6 with nesting)
- [x] Click heading → scroll editor to that heading
- [x] Live update via ProseMirror transaction listener (debounced 300ms)
- [x] Collapsible heading sections in outline
- [x] Active heading highlighting (track scroll position)
- [x] Add Outline tab to right sidebar (alongside Links panel)
- [x] Hotkey: `Cmd+Shift+O` to toggle outline panel

### Reference

- [x] Study Moraya's `OutlinePanel.svelte` for heading extraction patterns

### Testing

- [x] Test heading extraction from various markdown structures
- [ ] Test scroll-to-heading behavior (requires browser environment)
- [ ] Test live update debouncing (requires browser environment)

---

## Phase 3: macOS Default App Registration

### Backend (Rust)

- [x] Add `fileAssociations` to `tauri.conf.json` for `.md`, `.markdown`, `.mdx`
- [x] Handle file-open events in Rust (adapt Moraya's `lib.rs` pattern)
- [x] Emit event to frontend with file path on open
- [x] Add `resolve_file_to_vault` Tauri command

### Frontend

- [x] Handle file-open event: if file is in known vault → open vault + navigate to file
- [x] Handle file-open event: if file outside any vault → toast prompting to add folder as vault
- [ ] Support drag-and-drop `.md` files onto dock icon

### Testing

- [ ] Test file association registration
- [ ] Test `resolve_file_to_vault` logic
- [ ] Test opening file inside known vault
- [ ] Test opening file outside any vault

---

## Phase 4: Document Split View

### Frontend

- [ ] Extend center editor pane to support multiple editor instances
- [ ] `Cmd+\` to split editor area into two panes
- [ ] Each pane opens a different file independently
- [ ] Leverage existing `Resizable.PaneGroup` infrastructure
- [ ] Drag tab to split, drag back to merge
- [ ] `Cmd+W` to close split pane
- [ ] Max 2–3 panes
- [ ] Remember split state per vault

### Editor

- [ ] Support multiple concurrent Milkdown instances (separate ProseMirror sessions)
- [ ] Each pane has independent dirty state, cursor, scroll position
- [ ] Active pane tracking for keyboard shortcuts and status bar

### Testing

- [ ] Test split/merge lifecycle
- [ ] Test independent editing in split panes
- [ ] Test dirty state isolation between panes

---

## Phase 5: Git Enhancements

### Backend (Rust)

- [ ] Add `git_push(vault_path, remote?)` command — detect remotes, SSH/HTTPS auth
- [ ] Add `git_pull(vault_path, remote?)` command
- [ ] SSH auth: detect `~/.ssh` keys, support ssh-agent via `git2` SSH transport
- [ ] HTTPS: credential helper passthrough

### Frontend

- [ ] Add Push/Pull buttons to `git_status_widget.svelte`
- [ ] Show sync progress indicator during push/pull
- [ ] Show ahead/behind counts in status bar
- [ ] Auto-commit settings UI: off / on-save / every N minutes (configurable per vault)
- [ ] Extend `git_autocommit.reactor` with interval-based auto-commit

### Testing

- [ ] Test push/pull with SSH remote
- [ ] Test auto-commit on save
- [ ] Test auto-commit interval

---

## Phase 6: Terminal Panel

### Backend (Rust)

- [ ] Add `portable-pty` crate to `Cargo.toml`
- [ ] Tauri commands: `terminal_spawn`, `terminal_write`, `terminal_resize`, `terminal_kill`
- [ ] Spawn PTY with user's default shell, inheriting environment
- [ ] Working directory defaults to active vault root
- [ ] Bidirectional streaming via Tauri events

### Frontend

- [ ] Add `xterm.js` + `xterm-addon-fit` to `package.json`
- [ ] Create `TerminalPanel.svelte` — bottom panel
- [ ] Toggle with `Cmd+\``
- [ ] Draggable resize handle between editor and terminal
- [ ] Terminal persists across file/tab switches
- [ ] Integrate into `workspace_layout.svelte` as vertical split below editor

### Stretch

- [ ] Multiple terminal tabs (`Cmd+Shift+\``)

### Testing

- [ ] Test PTY spawn/kill lifecycle
- [ ] Test terminal resize
- [ ] Test terminal persistence across tab switches

---

## Phase 7: In-App Document Viewer

### Architecture

- [ ] Create `DocumentViewer.svelte` — dispatches to renderer by file extension
- [ ] Extend editor pane: show Milkdown for `.md`, appropriate viewer for other types

### PDF Viewer

- [ ] Add `pdfjs-dist` to `package.json`
- [ ] Render PDF in editor pane: page navigation, zoom, scroll, text search
- [ ] "Open to Side" context menu for side-by-side PDF + notes

### Image Viewer

- [ ] Display PNG, JPG, SVG, GIF, WebP in editor pane
- [ ] Zoom/pan controls, fit-to-width default
- [ ] Dark/light checkerboard for transparent images

### CSV/TSV Viewer

- [ ] Add `papaparse` to `package.json`
- [ ] Render as scrollable, sortable table
- [ ] Column resize, row count display

### Code/Text Viewer

- [ ] Syntax-highlighted read-only view (Shiki or highlight.js)
- [ ] Line numbers, copy button
- [ ] Support: `.py`, `.R`, `.rs`, `.json`, `.yaml`, `.toml`, `.sh`

### Cross-cutting

- [ ] File tree icon badges by file type
- [ ] Drag non-markdown file into note → insert markdown link
- [ ] PDF export of notes (adapt Moraya's jsPDF)

### Stretch

- [ ] PDF text selection → "Copy as Quote" into active note
- [ ] PDF annotations stored in `.carbide/annotations/<filename>.json`

### Testing

- [ ] Test PDF rendering and navigation
- [ ] Test image viewer zoom/pan
- [ ] Test CSV parsing and table rendering
- [ ] Test syntax highlighting for each supported language

---

## Phase 8: Plugin System

### Backend (Rust)

- [ ] Plugin discovery: scan `<vault>/.carbide/plugins/` for `manifest.json`
- [ ] Manifest parsing and permission validation
- [ ] Tauri commands for plugin ↔ vault/git/fs operations (gated by permissions)

### Frontend

- [ ] Plugin sandbox: each plugin runs in sandboxed iframe
- [ ] `postMessage`-based RPC bridge between plugin iframe and main app
- [ ] TypeScript SDK: `@carbide/plugin-api` with types for Vault, Editor, Commands, UI, Events, Settings
- [ ] Lifecycle: discover → validate → load → activate → deactivate
- [ ] Hot-reload in dev mode

### Demo Plugins

- [ ] "Hello World" — registers command palette entry, inserts text at cursor
- [ ] "Word Count" — status bar item with live word/character count
- [ ] "LaTeX Snippets" — snippet expansion (`//frac` → `\frac{}{}`)

### Testing

- [ ] Test plugin discovery and manifest validation
- [ ] Test plugin sandbox isolation
- [ ] Test RPC bridge communication
- [ ] Test each demo plugin

---

## Notes

### Single-Vault Assumptions (relevant if simultaneous multi-vault is pursued later)

These locations assume `VaultStore.vault` is a single vault — no changes needed for
the dropdown switcher (Phase 1), but would need refactoring for simultaneous multi-vault:

| Location                          | Assumption                                           |
| --------------------------------- | ---------------------------------------------------- |
| `VaultStore.vault: Vault \| null` | Single active vault                                  |
| `VaultService.switch_vault()`     | Resets ALL stores (notes, editor, tabs, search, git) |
| `NotesStore`                      | One flat `notes[]` array for one vault               |
| `EditorStore.open_note`           | Singular open note, no vault context                 |
| `TabStore.tabs[]`                 | All tabs belong to one vault                         |
| `GitStore`                        | One branch, one dirty state                          |
| `SearchStore`                     | One index progress tracker                           |
| Omnibar scope                     | `"current_vault"` is the only vault                  |
| Wikilink resolution               | Resolves within "the" vault                          |

### Architecture Docs Reference

- `devlog/coding_guidelines.md` — Code hygiene rules
- `devlog/architecture.md` — Decision tree for feature implementation (if exists)
- Layering enforced by `scripts/lint_layering_rules.mjs`
