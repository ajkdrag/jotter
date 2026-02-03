# Architecture & Design Bible

> This document serves as the authoritative guide to the codebase architecture. It captures the deliberate design choices, layering, and separation of concerns that must be respected by all contributors.

## Core Philosophy

The codebase is built on the principles of **Hexagonal Architecture (Ports and Adapters)**, **State-Driven Logic**, and **Functional Core, Imperative Shell**.

-   **Decoupling**: UI components are strictly "dumb" and unaware of the state management library (XState).
-   **Testability**: Business logic is isolated in pure functions ("Operations") and testable state machines ("Flows").
-   **Single Source of Truth**: The global application state is strictly separated from transient user-experience processes (Flows).
-   **Consistency**: Every user experience (e.g., "Deleting a note", "Switching Vaults") is modeled as a discrete "Flow".

---

## Definitive Guide: Building Features

This is the canonical, non-negotiable workflow for adding new features. If a change does not fit this model, update this document first.

### The Composition Root (Where Wiring Happens)
**Location:** `src/routes/+page.svelte` (and other route entry points as needed)

-   Create ports via `create_prod_ports`.
-   Create `app` via `create_app_flows(ports, callbacks)`.
-   Create any adapter-level managers (e.g., `editor_manager`).
-   Create controllers (e.g., `create_app_shell_actions`) and pass them down.
-   **Never** instantiate flows or adapters inside UI components.

### The Data & Control Flow (Happy Path)
1.  **UI Component** emits an intent via a callback.
2.  **Controller** translates the intent into a Flow event.
3.  **Flow** orchestrates work: calls Operations, updates Stores, manages transient UI state.
4.  **Operation** performs business logic via Ports and returns domain data.
5.  **Adapter** is the concrete implementation of a Port (web/tauri/editor).
6.  **Store** holds persistent application state and notifies UI.

### Side Effects: Where They Belong
-   **Adapters**: external I/O and environment interaction (filesystem, IPC, browser APIs).
-   **Operations**: business logic with side effects via Ports.
-   **Flows**: orchestrate side effects by invoking Operations and updating Stores.
-   **Controllers**: no Ports, no async I/O. Only send Flow events and call Store actions for UI-level state.
-   **Components**: no side effects except DOM interaction and callbacks.

### State Ownership Rules
-   **Long-lived state** → `stores/` (vault, notes, editor, UI preferences).
-   **Transient UX state** → `flows/` (dialogs, loading, error states, confirmation steps).
-   **One-off computations** → `utils/` (pure helpers).
-   **Domain types** → `types/` (no dependencies on stores/adapters).

### Where to Put New Code (File Placement)
-   **Ports**: `src/lib/ports/*_port.ts` (+ bundle in `ports.ts`).
-   **Adapters**: `src/lib/adapters/<web|tauri|editor|test>/...`.
-   **Operations**: `src/lib/operations/*.ts` (pure, stateless, port-driven).
-   **Flows**: `src/lib/flows/*_flow.ts` (state machines + orchestration).
-   **Controllers**: `src/lib/controllers/*` (UI intent → Flow events).
-   **Stores**: `src/lib/stores/*` (global state + pure actions).
-   **Components**: `src/lib/components/*` (presentational UI).
-   **Utils**: `src/lib/utils/*` (pure helpers).
-   **Types**: `src/lib/types/*` (domain and UI types).

### Feature Development Checklist
-   Define the **user experience** as a Flow (states + events).
-   Implement **Operations** for business logic; keep them pure and testable.
-   Add or update **Ports/Adapters** only when you need new external dependencies.
-   Update **Stores** only for long-lived state; keep actions pure.
-   Wire everything in the **composition root** (route).
-   Add tests:
    -   Operations → `tests/unit/operations/*`
    -   Flows → `tests/integration/flows/*`
    -   Stores → `tests/unit/stores/*`
    -   Adapters → `tests/unit/adapters/*` as appropriate

### Explicit No-Gos
-   UI components **must not** import `xstate`, Ports, or Operations.
-   Controllers **must not** call Ports directly.
-   Stores **must not** perform async work.
-   Operations **must not** mutate Stores or call UI code.

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
    -   `AssetsPort` - Asset management (`import_asset`)
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
        -   `dirty_state_plugin.ts`, `markdown_link_input_rule.ts`, `editor_manager.ts`
    -   `theme_adapter.ts` - Theme persistence (shared; uses settings/localStorage)
    -   `test/` - Test implementations for unit testing
        -   `test_notes_adapter.ts`, `test_vault_adapter.ts`, `test_workspace_index_adapter.ts`, `test_assets_adapter.ts`, `test_settings_adapter.ts`, `test_ports.ts`
-   **Factory**: `create_prod_ports.ts` - Creates production port instances based on platform detection (`detect_platform.ts`)
-   **Purpose**: Platform-specific implementations that satisfy port contracts

### 3. Operations (Business Logic)
**Location:** `src/lib/operations/`

Operations are **pure functions** (or functional stateless modules) that implement specific business rules. They accept `Ports` as arguments to perform their side effects.

-   **Characteristics**:
    -   Stateless.
    -   Receive dependencies (Ports) as arguments.
    -   Return Promises (usually).
    -   Do NOT manage UI state (loading, error, etc.).
-   **Current Operations**:
    -   `change_vault.ts` - Vault switching logic
    -   `create_folder.ts` - Folder creation
    -   `delete_note.ts` - Note deletion logic
    -   `ensure_open_note.ts` - Ensures a note is open (used by app state)
    -   `insert_dropped_image.ts` - Image insertion from drag-and-drop
    -   `open_last_vault.ts` - Opens the last used vault
    -   `open_note.ts` - Note opening logic
    -   `open_note_or_create.ts` - Note open-or-create logic (wiki links)
    -   `rename_note.ts` - Note renaming logic
    -   `save_note.ts` - Note saving logic
    -   `save_note_operation.ts` - Core save logic (used by save_note flow)
    -   `startup_app.ts` - App startup (theme, settings init)
    -   `apply_editor_styles.ts`, `init_theme.ts`, `load_editor_settings.ts` - Editor/theme setup

### 4. Stores (Global Source of Truth)
**Location:** `src/lib/stores/`

The central "Brain" of the application. Stores manage long-lived data like the Current Vault, List of Notes, and the Open Note using Svelte 5's reactive runes.

-   **Pattern**: Uses **Svelte 5 Runes** (`$state`) with a pub/sub API for non-Svelte consumers.
-   **Current Stores**:
    -   `vault_store.ts` - Current active vault and recently opened vaults
    -   `notes_store.ts` - List of all notes metadata and folder paths in current vault
    -   `editor_store.ts` - Currently open note (metadata, markdown content, dirty state)
    -   `ui_store.ts` - UI preferences and transient UI state
-   **Infrastructure**:
    -   `create_store.svelte.ts` - Factory for creating reactive stores with typed actions
    -   `store_handle.ts` - Type definitions for store handles (`StoreHandle`, `StoreSnapshot`)
    -   `create_app_stores.ts` - Dependency injection root for stores
-   **Interaction**: Feature Flows read from stores and dispatch actions to update them.

### 5. Flows (User Experience & Orchestration)
**Location:** `src/lib/flows/`

A "Flow" represents a discrete unit of user experience. It encapsulates the **State Machine** that drives a specific feature.

-   **Responsibilities**:
    -   Manages **Transient UI State** (e.g., `idle`, `confirming`, `deleting`, `error`).
    -   Invokes **Operations** (e.g., calls `delete_note` when in `deleting` state).
    -   Updates **Stores** with the results of operations.
-   **Lean Machines**: Flows should be thin orchestrators. They delegate business logic to Operations and state updates to Stores.
-   **Current Flows**:
    -   `app_startup_flow.ts` - Theme and settings initialization on app load
    -   `open_app_flow.ts` - Vault selection and application bootstrap
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

### 6. Controllers (UI Intent Translation)
**Location:** `src/lib/controllers/`

Controllers are the thin glue between UI events and Flow events.

-   **Responsibilities**:
    -   Translate UI intents into Flow events.
    -   Perform lightweight, synchronous Store updates for UI-only state.
-   **Constraints**:
    -   Do NOT call Ports directly.
    -   Do NOT import or depend on Adapters.
    -   Do NOT perform async I/O.

### 7. The Bridge: Hooks
**Location:** `src/lib/hooks/`

This is the deliberate decoupling layer between XState and Svelte components.

-   **`use_flow_handle.svelte.ts`**: A Svelte 5 hook that wraps an XState Actor.
    -   Subscribes to the actor and exposes a reactive `snapshot` and `send` method using Svelte 5 Runes (`$state`).
    -   Handles cleanup on component destruction (`onDestroy`).
    -   Stops the actor when the component unmounts.
-   **`is-mobile.svelte.ts`**: Platform detection hook for responsive UI.
-   **Benefit**: UI components receive a reactive object. They don't know it's XState.

### 8. UI Components ("Dumb" & Decoupled)
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

### 9. Types (Domain Models)
**Location:** `src/lib/types/`

Pure TypeScript type definitions for domain entities.

-   `ids.ts` - Type-safe ID types (`NoteId`, `VaultId`, `NotePath`, `VaultPath`, `MarkdownText`)
-   `note.ts` - Note domain types (`NoteMeta`, `NoteDoc`)
-   `vault.ts` - Vault domain types (`Vault`)
-   `editor.ts` - Editor state types (`OpenNoteState`)
-   `editor_settings.ts` - Editor settings types
-   `theme.ts` - Theme mode types

### 10. Utils (Pure Helpers)
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

This file is where the application is "wired" together. It creates the stores and instantiates all feature flows with their dependencies.

**Current Implementation:**
-   Creates stores via create_app_stores.ts
-   Instantiates all feature flows with injected ports and stores
-   Returns `AppFlows` type with `stores` and `flows` object
-   Optional `CreateAppFlowsCallbacks` for shell callbacks

**Flow Dependencies:**
-   `app_startup` - Requires `theme`, `settings` ports + `stores`
-   `open_app` - Requires `vault`, `notes`, `index` ports + `stores`
-   `change_vault` - Requires `vault`, `notes`, `index` ports + `stores`
-   `open_note` - Requires `notes` port + `stores`
-   `delete_note` - Requires `notes`, `index` ports + `stores`
-   `rename_note` - Requires `notes`, `index` ports + `stores`
-   `delete_folder` - Requires `notes`, `index` ports + `stores`
-   `rename_folder` - Requires `notes`, `index` ports + `stores`
-   `save_note` - Requires `notes` port + `stores` + optional `on_save_complete`
-   `create_folder` - Requires `notes` port + `stores`
-   `filetree` - Requires `notes` port + `stores`
-   `settings` - Requires `settings` port
-   `command_palette` - No ports
-   `file_search` - Requires `search` port
-   `clipboard` - Requires `clipboard` port
-   `theme` - Requires `theme` port

**Usage:** Called once at application startup in `src/routes/+page.svelte` and injected into `AppShell`.

---

## Directory Organization Summary

```
src/lib/
├── ports/           # Interface contracts + bundle type
├── adapters/        # Platform implementations (web/, tauri/, editor/, theme, test/)
├── operations/      # Pure business logic functions
├── stores/          # Global reactive state + infrastructure
├── flows/           # Feature state machines + infrastructure
├── controllers/     # UI intent → Flow events
├── hooks/           # Svelte integration layer
├── components/      # UI components (feature + ui primitives)
├── types/           # Domain type definitions
└── utils/           # Pure utility functions
```

## Key Implementation Guidelines

1.  **Naming Consistency**: Always refer to the global stores as `stores`. Avoid terms like `model` or `state`.
2.  **State vs. Flow**: If a piece of data needs to persist (e.g., "Which vault is open?"), it belongs in `src/lib/stores/`. If it is temporary (e.g., "Is the delete confirmation dialog open?"), it belongs in a Flow.
3.  **No Side-Effects in Stores**: The stores must remain pure. They should only manage state updates. All async work happens in Flows.
4.  **Test the Store Updates**: When adding logic to stores, export the logic as a pure function and add a unit test for it in `tests/unit/stores/`. Prefer to keep the stores lean (even when creating new flows, or updating existing flows, move logic in plain, testable functions).
5.  **File Naming**: All files use snake_case, regardless of tech stack (TypeScript, Svelte, Rust).
    -   **Exception**: `src/lib/components/ui/**` mirrors shadcn-svelte file names and is exempt.
6.  **Port Organization**: Adapters are organized by platform (`web/`, `tauri/`) and domain (`editor/`, `test/`). Shared adapters (e.g. `theme_adapter.ts`) live at adapters root.
7.  **Component Separation**: Feature components (business logic) are separate from UI primitives (`ui/` directory).
8.  **Type Safety**: Use branded types from `types/ids.ts` for IDs and paths to prevent mixing incompatible values.
