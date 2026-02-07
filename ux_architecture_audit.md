# UX Architecture Audit (Strict-Mode)

Date: 2026-02-06

This audit checks each user experience against:

- `/Users/altamkhan/Workspace/scratch/jotter/proposed_architecture.md`
- `/Users/altamkhan/Workspace/scratch/jotter/architecture.md`
- layering constraints enforced by `/Users/altamkhan/Workspace/scratch/jotter/scripts/lint_layering_rules.mjs`

Legend:

- ✅ compliant
- ⚠️ partial (works, but violates strict intent or introduces coupling risk)
- ❌ non-compliant

---

## Global Constraint Check

- ✅ Components/routes mutate via command bus only (no direct `flow.send` / `app.dispatch`)  
  Evidence: `/Users/altamkhan/Workspace/scratch/jotter/src/lib/components/app_shell.svelte:98`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/components/app_sidebar.svelte:65`
- ✅ Runtime split is clean: orchestration routes vs UI effects  
  Evidence: `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_event_routes.ts:10`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_ui_effects.ts:6`
- ✅ Use cases stay UI-agnostic (no UI/runtime imports)
- ✅ Stores stay reducer-only
- ✅ `pnpm lint:layering` currently passes

---

## UX-by-UX Audit

### 1) App startup + bootstrap

- **Entry:** `APP_MOUNTED`
- **Path:** command → `preferences_initialization_flow` + `vault_bootstrap_flow` → use cases → events → reducers
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/commands/attach_app_command_handlers.ts:23`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/vault_bootstrap_flow.ts:91`

### 2) Change vault (choose/select recent)

- **Entry:** `REQUEST_CHANGE_VAULT`, `CHOOSE_VAULT`, `SELECT_VAULT`
- **Path:** command → `change_vault_flow` → `choose_vault_use_case`/`change_vault_use_case` → events
- **Status:** ⚠️
- **Finding:** actor dispatches events directly during invocation (`ui_system_dialog_set` + domain events) instead of returning a single event list for `onDone` application.
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/change_vault_flow.ts:70`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/change_vault_flow.ts:81`

### 3) Open note / open wiki link / create note

- **Entry:** `OPEN_NOTE`, `OPEN_WIKI_LINK`, `CREATE_NEW_NOTE`
- **Path:** command → `open_note_flow` → `open_note_use_case`/`create_untitled_note_use_case` → events
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/open_note_flow.ts:64`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/use_cases/open_note_use_case.ts:46`

### 4) Editor lifecycle + live editing

- **Entry:** `EDITOR_MOUNT_REQUESTED`, `EDITOR_UNMOUNT_REQUESTED`, plus `open_note_set` route
- **Path:** command/events → `editor_flow` → `editor_runtime` → emits editor facts (`editor_markdown_changed`, `editor_dirty_changed`, etc.)
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/editor_flow.ts:85`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/shell/editor_runtime.ts:38`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_event_routes.ts:21`

### 5) Save note

- **Entry:** `REQUEST_SAVE_NOTE`, confirm/cancel/retry commands
- **Path:** command → `save_note_flow` → `save_note_flush_requested` event → runtime event routes trigger editor flush → `editor_flushed` fact routes back to save flow → `save_note_use_case` → `note_saved` event
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/save_note_flow.ts:239`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_event_routes.ts:41`

### 6) Delete note

- **Entry:** `REQUEST_DELETE_NOTE`, confirm/cancel/retry
- **Path:** command → `delete_note_flow` → `delete_note_use_case` → events
- **Status:** ⚠️
- **Finding:** domain invariants/context derivation (vault presence, open-note checks) still live in flow context/guards instead of being fully use-case-owned.
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/delete_note_flow.ts:99`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/delete_note_flow.ts:104`

### 7) Rename note

- **Entry:** `REQUEST_RENAME_NOTE`, update/confirm/retry
- **Path:** command → `rename_note_flow` → `rename_note_use_case` → events
- **Status:** ⚠️
- **Finding:** conflict existence check (`note_path_exists`) is performed in flow, not use case.
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/rename_note_flow.ts:54`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/rename_note_flow.ts:153`

### 8) Create folder

- **Entry:** `REQUEST_CREATE_FOLDER`, update/confirm/cancel
- **Path:** command → `create_folder_flow` → `create_folder_use_case` → events
- **Status:** ⚠️
- **Finding:** vault invariant is flow-guarded, and input validation is minimal (`trim`) in use case.
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/create_folder_flow.ts:91`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/use_cases/create_folder_use_case.ts:9`

### 9) Delete folder

- **Entry:** `REQUEST_DELETE_FOLDER`, confirm/cancel/retry
- **Path:** command → `delete_folder_flow` → `get_folder_stats_use_case` + `delete_folder_use_case` → events
- **Status:** ⚠️
- **Finding:** `contains_open_note` and vault derivation are in flow (not fully pushed down).
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/delete_folder_flow.ts:120`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/delete_folder_flow.ts:116`

### 10) Rename folder

- **Entry:** `REQUEST_RENAME_FOLDER`, update/confirm/retry
- **Path:** command → `rename_folder_flow` → `rename_folder_use_case` → events
- **Status:** ⚠️
- **Finding:** vault presence invariant remains flow-side.
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/rename_folder_flow.ts:91`

### 11) Filetree navigation (expand/collapse/retry/refresh)

- **Entry:** `TOGGLE_FILETREE_FOLDER`, `RETRY_LOAD_FOLDER`, `COLLAPSE_ALL_FOLDERS`, `REFRESH_FILETREE`
- **Path:** command → `filetree_flow` (transient UX + async loading) → folder-content events
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/commands/attach_app_command_handlers.ts:157`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/filetree_flow.ts:238`

### 12) Command palette

- **Entry:** open/close/toggle/query/select commands
- **Path:** command → `command_palette_flow`, then command fan-out for selected actions
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/command_palette_flow.ts:44`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/commands/attach_app_command_handlers.ts:217`

### 13) File search

- **Entry:** open/close/query/select commands
- **Path:** command → `file_search_flow` → `search_notes_use_case` (query) → result context → confirm dispatches `OPEN_NOTE`
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/file_search_flow.ts:50`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/commands/attach_app_command_handlers.ts:254`

### 14) Settings + theme

- **Entry:** `OPEN_SETTINGS`, `UPDATE_SETTINGS`, `SAVE_SETTINGS`, `SET_THEME`
- **Path:** commands → `settings_flow` / `theme_flow` → settings/theme use cases → events; UI styles via runtime UI-effects
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/settings_flow.ts:54`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/theme_flow.ts:46`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_ui_effects.ts:11`

### 15) Clipboard copy

- **Entry:** `COPY_OPEN_NOTE_MARKDOWN`
- **Path:** command → `clipboard_flow` → `write_clipboard_use_case` → success/failure events → toast via UI-effects
- **Status:** ✅
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/clipboard_flow.ts:67`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/use_cases/write_clipboard_use_case.ts:10`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_ui_effects.ts:14`

### 16) Sidebar toggle + folder selection

- **Entry:** `TOGGLE_SIDEBAR`, `SELECT_FOLDER_PATH`
- **Path:** command handler emits reducer events directly (`ui_sidebar_toggled`, `ui_selected_folder_set`)
- **Status:** ✅ (by current architecture contract)
- **Evidence:** `/Users/altamkhan/Workspace/scratch/jotter/src/lib/commands/attach_app_command_handlers.ts:150`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/stores/ui_store.ts:36`

---

## Cross-Cutting Gaps (Strict-Mode)

1) **Invariant placement is still mixed (flow + use case)**  
Vault/open-note/path-conflict checks are still spread through flow guards/actions.  
Evidence:  
- `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/create_folder_flow.ts:91`  
- `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/delete_note_flow.ts:99`  
- `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/rename_note_flow.ts:54`

2) **`ui_runtime_state_set` is a projection event, not a domain fact**  
Useful for UI read-model consistency, but semantically different from business facts.  
Evidence: `/Users/altamkhan/Workspace/scratch/jotter/src/lib/runtime/attach_ui_runtime_projection.ts:105`, `/Users/altamkhan/Workspace/scratch/jotter/src/lib/events/app_event.ts:36`

3) **Flow composition surface is still large**  
`create_app_flows.ts` is still the dense dependency assembly point for all flow inputs.  
Evidence: `/Users/altamkhan/Workspace/scratch/jotter/src/lib/flows/create_app_flows.ts:67`

---

## Recommended Next Tightening Pass

1) Move remaining invariants into use cases (`vault required`, `path conflict`, `contains_open_note`) and keep flows orchestration-only.
2) Decide whether `ui_runtime_state_set` should stay as an event or become direct UI store projection with explicit naming (`ui_runtime_projected`).
