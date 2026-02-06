# Architecture & Design Bible

> This document serves as the authoritative guide to the codebase architecture. It captures the deliberate design choices, layering, and separation of concerns that must be respected by all contributors.

## Core Philosophy

The codebase is built on the principles of **Hexagonal Architecture (Ports and Adapters)**, **Event-Driven State**, and **Functional Core, Imperative Shell**.

-   **Decoupling**: UI components are strictly "dumb" and unaware of the state management library (XState).
-   **Testability**: Business logic lives in use cases and pure helpers; state transitions are reducers; UX orchestration stays in Flows.
-   **Single Source of Truth**: The global application state is strictly separated from transient user-experience processes (Flows).
-   **Consistency**: Every user experience (e.g., "Deleting a note", "Switching Vaults") is modeled as a discrete "Flow".

---

## Definitive Guide: Building Features

This is the canonical, non-negotiable workflow for adding new features. If a change does not fit this model, update this document first.

### The Composition Root (Where Wiring Happens)
**Location:** `src/routes/+page.svelte` (and other route entry points as needed)

-   Create ports via `create_prod_ports`.
-   Create stores via `create_app_stores`.
-   Create an event bus via `create_event_bus(stores)`.
-   Create runtime shell pieces (e.g., `create_editor_runtime`).
-   Create `app` via `create_app_flows({ ports, stores, dispatch, dispatch_many, now_ms, editor_runtime })`.
-   Attach shell reactions via `attach_shell_reactions`.
-   Create controllers (e.g., `create_app_shell_actions`) and pass them down.
-   **Never** instantiate flows or adapters inside UI components.

### The Data & Control Flow (Happy Path)
1.  **UI Component** emits an intent via a callback.
2.  **Controller** translates the intent into a Flow command (event) or dispatches a UI event.
3.  **Flow** orchestrates UX: calls a **Use Case** and manages transient UI state.
4.  **Use Case** performs business IO via Ports and returns **Events** (facts).
5.  **Event Bus** dispatches events to **Reducers** in stores.
6.  **Stores** update persistent state and notify UI.
7.  **Shell Reactions** observe events and run UI-only effects (toast, focus, editor runtime).

### Side Effects: Where They Belong
-   **Adapters**: external I/O and environment interaction (filesystem, IPC, browser APIs).
-   **Use Cases**: business IO via Ports, returns Events.
-   **Flows**: orchestrate use cases and apply returned Events.
-   **Shell**: UI-only effects (toasts, focus, editor runtime, DOM updates).
-   **Controllers**: no Ports, no async I/O. Only send Flow events or dispatch UI events.
-   **Components**: no side effects except DOM interaction and callbacks.

### State Ownership Rules
-   **Long-lived state** → `stores/` (vault, notes, editor, UI preferences) via reducers.
-   **Transient UX state** → `flows/` (dialogs, loading, error states, confirmation steps).
-   **Facts about change** → `events/` (event type definitions).
-   **One-off computations** → `utils/` (pure helpers).
-   **Domain types** → `types/` (no dependencies on stores/adapters).

### Where to Put New Code (File Placement)
-   **Ports**: `src/lib/ports/*_port.ts` (+ bundle in `ports.ts`).
-   **Adapters**: `src/lib/adapters/<web|tauri|editor|test>/...`.
-   **Events**: `src/lib/events/*` (event type definitions).
-   **Use Cases**: `src/lib/use_cases/*` (effectful, returns events).
-   **Operations**: `src/lib/operations/*` (pure helpers used by use cases).
-   **Flows**: `src/lib/flows/*_flow.ts` (state machines + orchestration).
-   **Controllers**: `src/lib/controllers/*` (UI intent → Flow events).
-   **Stores**: `src/lib/stores/*` (global state + reducers).
-   **Shell**: `src/lib/shell/*` (runtime-only side effects).
-   **Components**: `src/lib/components/*` (presentational UI).
-   **Utils**: `src/lib/utils/*` (pure helpers).
-   **Types**: `src/lib/types/*` (domain and UI types).

### Feature Development Checklist
-   Define the **user experience** as a Flow (states + commands).
-   Implement **Use Cases** for business IO; return Events.
-   Add or update **Ports/Adapters** only when you need new external dependencies.
-   Update **Stores** only for long-lived state; keep reducers pure.
-   Add **Shell reactions** for UI-only effects.
-   Wire everything in the **composition root** (route).
-   Add tests:
    -   Use Cases → `tests/unit/use_cases/*`
    -   Operations (helpers) → `tests/unit/operations/*`
    -   Flows → `tests/integration/flows/*`
    -   Stores → `tests/unit/stores/*`
    -   Adapters → `tests/unit/adapters/*` as appropriate

### Explicit No-Gos
-   UI components **must not** import `xstate`, Ports, or Use Cases.
-   Controllers **must not** call Ports directly.
-   Flows **must not** call Ports directly (use cases only).
-   Stores **must not** perform async work.
-   Use Cases **must not** mutate Stores or call UI code.

### Automated Layering Guard
-   Run `pnpm lint:layering` to enforce architecture boundaries with static checks.
-   `pnpm lint` includes this guard and fails on boundary violations before ESLint.
-   Current enforced checks:
    -   components cannot import `xstate`, ports, adapters, or use cases
    -   controllers cannot import ports, adapters, or use cases
    -   flows cannot import adapters/components/UI libs and cannot call `ports.*.*()` directly
    -   use cases cannot import UI/store/flow/adapter/shell layers or touch DOM/toast APIs
    -   stores cannot import runtime layers and cannot contain async code
    -   shell cannot import stores or use cases

## Layering Architecture

The application is structured into clear layers, flowing from the core logic out to the implementation details.

### 1. Ports (Contracts)
**Location:** `src/lib/ports/`

Ports define the **interfaces** for external dependencies. They are pure TypeScript `interface` definitions with NO implementation logic.

-   **Purpose**: To abstract away the differences between environments (e.g., Web vs. Desktop/Tauri).
-   **Current Ports**:
    -   `NotesPort` - Note CRUD operations (`list_notes`, `read_note`, `write_note`, `create_note`, `rename_note`, `delete_note`)
    -   `VaultPort` - Vault management (`open_vault`, `list_vaults`, `remember_last_vault`, etc.)
    -   `WorkspaceIndexPort` - Search and indexing operations (`index_build`, `index_search`, `index_backlinks`, `index_outlinks`)
    -   `AssetsPort` - Asset URL resolution (`resolve_asset_url`)
    -   `SearchPort` - Search operations (`search_notes`)
    -   `SettingsPort` - Application settings (`get_setting`, `set_setting`)
    -   `ThemePort` - Theme management (`get_theme`, `set_theme`, `get_resolved_theme`)
    -   `EditorPort` - Editor integration (Milkdown-specific operations)
    -   `ClipboardPort` - Clipboard integration (`write_text`)
-   **Bundle Type**: `ports.ts` defines the `Ports` aggregate type for wiring.

### 2. Adapters (Implementation)
**Location:** `src/lib/adapters/`

Adapters implement the Ports, providing concrete implementations for specific environments.

-   **Organization**:
    -   `web/` - Web browser implementations using LocalStorage/OPFS
        -   `notes_web_adapter.ts`, `vault_web_adapter.ts`, `workspace_index_web_adapter.ts`, `assets_web_adapter.ts`, `settings_web_adapter.ts`, `storage.ts`
    -   `tauri/` - Tauri desktop implementations using Rust filesystem
        -   `notes_tauri_adapter.ts`, `vault_tauri_adapter.ts`, `workspace_index_tauri_adapter.ts`, `assets_tauri_adapter.ts`, `settings_tauri_adapter.ts`
        -   `tauri_invoke.ts` - Tauri IPC wrapper
        -   `dialog_adapter.ts` - Native dialog integration
    -   `editor/` - Editor-specific adapters
        -   `milkdown_adapter.ts` - Milkdown editor integration
        -   `dirty_state_plugin.ts`, `markdown_link_input_rule.ts`, `markdown_paste_plugin.ts`
    -   `theme_adapter.ts` - Theme persistence (shared; uses settings/localStorage)
    -   `test/` - Test implementations for unit testing
        -   `test_notes_adapter.ts`, `test_vault_adapter.ts`, `test_workspace_index_adapter.ts`, `test_assets_adapter.ts`, `test_settings_adapter.ts`, `test_ports.ts`
-   **Factory**: `create_prod_ports.ts` - Creates production port instances based on platform detection (`detect_platform.ts`)
-   **Purpose**: Platform-specific implementations that satisfy port contracts

### 3. Events (Facts)
**Location:** `src/lib/events/`

Events are the **language of state change**. They are facts like `note_saved`, `vault_set`, `open_note_set`.

-   **Constraint**: Events are facts, not commands. They do not execute work.
-   **Purpose**: Reducers consume events; shell reactions observe events.
-   **Notable Runtime Facts**:
    -   `editor_flushed` is emitted when the editor flushes markdown before save.
    -   `ui_theme_set_failed` is emitted when theme persistence fails.

### 4. Use Cases (Application Layer)
**Location:** `src/lib/use_cases/`

Use cases perform **business IO** through Ports and return `AppEvent[]`.

-   **Characteristics**:
    -   Effectful (call ports).
    -   Return events (facts), not store mutations.
    -   No UI or DOM access.
-   **Pure Helpers**: `src/lib/operations/*` holds pure helper functions used by use cases.

### 5. Stores (Reducers + Source of Truth)
**Location:** `src/lib/stores/`

The central "Brain" of the application. Stores manage long-lived data like the Current Vault, List of Notes, and the Open Note using Svelte 5's reactive runes.

-   **Pattern**: Uses **Svelte 5 Runes** (`$state`) with a pub/sub API for non-Svelte consumers.
-   **Current Stores**:
    -   `vault_store.ts` - Current active vault, recently opened vaults, and vault `generation` epoch
    -   `notes_store.ts` - List of all notes metadata and folder paths in current vault
    -   `editor_store.ts` - Currently open note (metadata, markdown content, dirty state)
    -   `ui_store.ts` - UI preferences and transient UI state
-   **Infrastructure**:
    -   `create_store.svelte.ts` - Factory for creating reactive stores with reducers
    -   `store_handle.ts` - Type definitions for store handles (`StoreHandle`)
    -   `create_app_stores.ts` - Dependency injection root for stores + dispatch
-   **Interaction**: Flows dispatch events; stores reduce them.
-   **Epoch Rule**: Vault-scoped async work must compare against `vault_store.generation` before reducing stale outputs.

### 6. Flows (User Experience & Orchestration)
**Location:** `src/lib/flows/`

A "Flow" represents a discrete unit of user experience. It encapsulates the **State Machine** that drives a specific feature.

-   **Responsibilities**:
    -   Manages **Transient UI State** (e.g., `idle`, `confirming`, `deleting`, `error`).
    -   Invokes **Use Cases** (business IO) and receives events.
    -   Dispatches events to stores.
-   **Lean Machines**: Flows should be thin orchestrators. They delegate business logic to Use Cases and state updates to reducers.
-   **Current Flows**:
    -   `preferences_initialization_flow.ts` - Load UI preferences (theme, editor settings) on app load
    -   `vault_bootstrap_flow.ts` - Bootstrap workspace (vault selection, notes, search index)
    -   `change_vault_flow.ts` - Vault switching flow
    -   `open_note_flow.ts` - Note opening flow
    -   `delete_note_flow.ts` - Note deletion flow with confirmation
    -   `rename_note_flow.ts` - Note renaming flow
    -   `save_note_flow.ts` - Note saving flow
    -   `create_folder_flow.ts` - Create folder flow
    -   `delete_folder_flow.ts` - Delete folder flow with confirmation
    -   `rename_folder_flow.ts` - Rename folder flow
    -   `settings_flow.ts` - Settings dialog flow
    -   `command_palette_flow.ts` - Command palette state (no ports)
    -   `file_search_flow.ts` - File search dialog flow
    -   `filetree_flow.ts` - File tree loading/expand/collapse
    -   `clipboard_flow.ts` - Clipboard side-effects
    -   `theme_flow.ts` - Theme side-effects
-   **Infrastructure**:
    -   `flow_engine.ts` - Creates flow handles from XState machines (`create_flow_handle`)
    -   `flow_handle.ts` - Type definitions for flow handles (`FlowHandle`, `FlowSnapshot`)
    -   `create_app_flows.ts` - Dependency injection root (see below)
-   **Vault Safety Rule**:
    -   vault changes dispatch clear-first events (`vault_cleared`, `notes_set[]`, `folders_set[]`, `open_note_cleared`) before applying the new vault snapshot
    -   filetree load actors are tagged with vault generation and stale generations are ignored deterministically

### 7. Controllers (UI Intent Translation)
**Location:** `src/lib/controllers/`

Controllers are the thin glue between UI events and Flow events.

-   **Responsibilities**:
    -   Translate UI intents into Flow events.
    -   Dispatch UI-only events (e.g., sidebar open/close).
-   **Constraints**:
    -   Do NOT call Ports directly.
    -   Do NOT import or depend on Adapters.
    -   Do NOT perform async I/O.

### 8. Shell (Runtime-Only Reactions)
**Location:** `src/lib/shell/`

Shell reactions observe events and perform UI/runtime-only effects.

-   Examples: toasts, focusing inputs, editor runtime actions, applying editor styles.
-   Constraints: No domain IO (that stays in use cases).

### 9. The Bridge: Hooks
**Location:** `src/lib/hooks/`

This is the deliberate decoupling layer between XState and Svelte components.

-   **`use_flow_handle.svelte.ts`**: A Svelte 5 hook that wraps an XState Actor.
    -   Subscribes to the actor and exposes a reactive `snapshot` and `send` method using Svelte 5 Runes (`$state`).
    -   Handles cleanup on component destruction (`onDestroy`).
    -   Stops the actor when the component unmounts.
-   **`is-mobile.svelte.ts`**: Platform detection hook for responsive UI.
-   **Benefit**: UI components receive a reactive object. They don't know it's XState.

### 10. UI Components ("Dumb" & Decoupled)
**Location:** `src/lib/components/`

Components are strictly presentational and decoupled from XState.

-   **Input**: Receives data via props (`snapshot.context` from flow handles).
-   **Output**: Emits user intents via callbacks (passed as props) or a generic `send` function.
-   **Constraint**: NEVER import `xstate` or business logic directly into a component.
-   **Note**: Container components may use hooks (`use_flow_handle`, `use_store_handle`) but should remain wiring-only. Leaf components must remain pure presentational UI.
-   **Organization**:
    -   **Feature Components** (top-level):
        -   `app_shell.svelte` - Main application shell
        -   `app_sidebar.svelte` - Sidebar navigation
        -   `activity_bar.svelte` - Activity bar
        -   `note_editor.svelte` - Markdown editor component
        -   `file_tree.svelte` - File tree navigation
        -   `vault_dialog.svelte` - Vault selection dialog
        -   `vault_selection_panel.svelte` - Vault selection UI
        -   `command_palette.svelte` - Command palette UI
        -   `create_folder_dialog.svelte` - Create folder dialog
        -   `delete_note_dialog.svelte` - Delete confirmation dialog
        -   `rename_note_dialog.svelte` - Rename dialog
        -   `save_note_dialog.svelte` - Save dialog
        -   `settings_dialog.svelte` - Settings dialog
        -   `theme_toggle.svelte` - Theme toggle
    -   **UI Primitives** (`ui/`):
        -   shadcn-svelte components: `badge/`, `button/`, `card/`, `context-menu/`, `dialog/`, `input/`, `label/`, `resizable/`, `select/`, `separator/`, `sheet/`, `sidebar/`, `skeleton/`, `slider/`, `tooltip/`
        -   Each component follows shadcn patterns with composable sub-components

---

### 11. Types (Domain Models)
**Location:** `src/lib/types/`

Pure TypeScript type definitions for domain entities.

-   `ids.ts` - Type-safe ID types (`NoteId`, `VaultId`, `NotePath`, `VaultPath`, `MarkdownText`)
-   `note.ts` - Note domain types (`NoteMeta`, `NoteDoc`)
-   `vault.ts` - Vault domain types (`Vault`)
-   `editor.ts` - Editor state types (`OpenNoteState`)
-   `editor_settings.ts` - Editor settings types
-   `theme.ts` - Theme mode types

### 12. Utils (Pure Helpers)
**Location:** `src/lib/utils/`

Pure utility functions with no side effects.

-   `filetree.ts` - File tree construction utilities (`build_filetree`)
-   `component_utils.ts` - Component helper functions
-   `asset_url.ts` - Asset URL generation utilities
-   `search_commands.ts`, `search_settings.ts` - Command palette filtering
-   `note_path_exists.ts` - Note path normalization + existence check

---

## Dependency Injection Root
**Location:** `src/lib/flows/create_app_flows.ts`

This file is where the application flows are "wired" together. It instantiates feature flows with their dependencies.

**Current Implementation:**
-   Accepts pre-built stores + event bus dispatch functions
-   Instantiates all feature flows with injected ports, stores, and dispatchers
-   Returns `AppFlows` with `stores`, `dispatch`, `dispatch_many`, and `flows`

**Flow Dependencies:**
-   `preferences_initialization` - Requires `theme`, `settings`, `vault_settings` ports + `stores` + `dispatch_many`
-   `vault_bootstrap` - Requires `vault`, `notes`, `index` ports + `stores` + `dispatch_many` + `now_ms`
-   `change_vault` - Requires `vault`, `notes`, `index` ports + `stores` + `dispatch_many` + `now_ms`
-   `open_note` - Requires `notes` port + `stores` + `dispatch_many` + `now_ms`
-   `delete_note` - Requires `notes`, `index` ports + `stores` + `dispatch_many` + `now_ms`
-   `rename_note` - Requires `notes`, `index` ports + `stores` + `dispatch_many`
-   `delete_folder` - Requires `notes`, `index` ports + `stores` + `dispatch_many` + `now_ms`
-   `rename_folder` - Requires `notes`, `index` ports + `stores` + `dispatch_many`
-   `save_note` - Requires `notes`, `index` ports + `stores` + `dispatch_many` + `editor_runtime`
-   `create_folder` - Requires `notes` port + `stores` + `dispatch_many`
-   `filetree` - Requires `notes` port + `stores` + `dispatch_many`
-   `settings` - Requires `settings`, `vault_settings` ports + `stores` + `dispatch_many`
-   `command_palette` - No ports
-   `file_search` - Requires `search` port
-   `clipboard` - Requires `clipboard` port + `dispatch_many`
-   `theme` - Requires `theme` port + `stores` + `dispatch_many`
-   `editor` - Requires `editor_runtime`

**Usage:** Called once at application startup in `src/routes/+page.svelte` and injected into `AppShell`.

---

## Directory Organization Summary

```
src/lib/
├── ports/           # Interface contracts + bundle type
├── adapters/        # Platform implementations (web/, tauri/, editor/, theme, test/)
├── events/          # Event type definitions
├── use_cases/       # Effectful application logic (returns events)
├── operations/      # Pure helper functions used by use cases
├── stores/          # Global reactive state + reducers
├── flows/           # Feature state machines + orchestration
├── controllers/     # UI intent → Flow events
├── shell/           # Runtime-only side effects
├── hooks/           # Svelte integration layer
├── components/      # UI components (feature + ui primitives)
├── types/           # Domain type definitions
└── utils/           # Pure utility functions
```

## Key Implementation Guidelines

1.  **Naming Consistency**: Always refer to the global stores as `stores`. Avoid terms like `model` or `state`.
2.  **State vs. Flow**: If a piece of data needs to persist (e.g., "Which vault is open?"), it belongs in `src/lib/stores/`. If it is temporary (e.g., "Is the delete confirmation dialog open?"), it belongs in a Flow.
3.  **No Side-Effects in Stores**: The stores must remain pure. They should only manage state updates. All async work happens in Flows.
4.  **Test the Reducers**: When adding reducer logic, keep it pure and add a unit test in `tests/unit/stores/`. Prefer small, readable reducers over complex branching.
5.  **File Naming**: All files use snake_case, regardless of tech stack (TypeScript, Svelte, Rust).
    -   **Exception**: `src/lib/components/ui/**` mirrors shadcn-svelte file names and is exempt.
6.  **Port Organization**: Adapters are organized by platform (`web/`, `tauri/`) and domain (`editor/`, `test/`). Shared adapters (e.g. `theme_adapter.ts`) live at adapters root.
7.  **Component Separation**: Feature components (business logic) are separate from UI primitives (`ui/` directory).
8.  **Type Safety**: Use branded types from `types/ids.ts` for IDs and paths to prevent mixing incompatible values.
