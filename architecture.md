# Architecture

This is the source-of-truth architecture for Jotter.

## Core model

Jotter is built on four primary layers:

- Ports + adapters for all external IO boundaries
- `$state` store classes for app state
- Services for async use-case orchestration
- Reactors for persistent store observation side effects
- A typed action registry as the single dispatch surface for user-triggerable intents

**Four layers. One dispatcher. No buses. No sagas.**

```
┌─────────────────────────────────────────────────────────┐
│  UI  (Svelte 5 + Shadcn-svelte)                         │
│  Reads stores via $derived. Triggers actions or UIStore.│
└───────────────────────┬─────────────────────────────────┘
                        │
             ┌──────────▼──────────┐
             │   Action Registry   │  Typed map of all triggerable actions.
             │   (shortcuts, menu, │  UI, command palette, and Tauri menus
             │    command palette)  │  all dispatch through here.
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │      Services       │  One public method = one use case.
             │                     │  Owns async, error handling, orchestration.
             │  Reads/writes Stores│  Calls Ports for IO.
             │  Calls Ports for IO │  Stateless between calls.
             └───────┬─────┬───────┘
                     │     │
          ┌──────────▼┐   ┌▼──────────┐
          │   Stores   │   │   Ports   │  Interfaces for all IO boundaries.
          │  ($state)  │   │ (interf.) │  Adapters implement for Tauri.
          └──────┬─────┘   └───────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
┌────▼─────┐          ┌─────▼──────┐
│ UI reads │          │  Reactors  │  Persistent observers.
│ $derived │          │  $effect   │  ONLY place store observation
└──────────┘          │  .root()   │  triggers service calls.
                      └────────────┘
```

## Runtime loop

Most user-triggered operations follow this loop:

1. UI calls `action_registry.execute(...)`
2. Action executes a service method (or direct UI store mutation for pure UI concerns)
3. Service performs IO through ports and updates domain/op stores
4. Action applies UI mutations from service outcomes when needed
5. Components rerender from store state
6. Reactors observe relevant store changes and trigger side effects through services or pure runtime utilities

## State ownership

### Domain state (`src/lib/stores`)

- `vault_store.svelte.ts`
- `notes_store.svelte.ts`
- `editor_store.svelte.ts`
- `search_store.svelte.ts`
- `tab_store.svelte.ts`
- `git_store.svelte.ts`

Rules:

- store methods are synchronous and deterministic
- no async/await in stores
- no imports from services, adapters, reactors, or UI components

### App UI state (`src/lib/stores/ui_store.svelte.ts`)

Owns ephemeral cross-screen UI state:

- dialogs (rename, delete, save, image paste, create folder, vault, settings, etc.)
- omnibar (command palette) and find-in-file panel state
- sidebar/filetree view state
- editor settings values used by UI
- hotkey recorder state

Rules:

- UI-only state lives here
- service/or action updates are explicit

### Operation state (`src/lib/stores/op_store.svelte.ts`)

Owns async operation status by key (`pending`, `success`, `error`) and error messages.

Rules:

- services write operation state
- components read operation state

### Component-local visual state

Purely local visual concerns remain inside components (`$state`, `$derived`, local `$effect`).

## Layer responsibilities

| Layer                | Responsibility                                                           | Rules                                                                                                         |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Ports & Adapters** | IO boundaries (vault, notes, index, search, clipboard, shell, git, etc.) | Port = interface. Adapter = factory fn. Services never import adapters — injected via constructor.            |
| **Stores**           | Reactive state (`$state` classes)                                        | Sync mutations only. No async. No imports of services/ports. Zero business logic.                             |
| **Services**         | Use cases (async workflows)                                              | Constructor receives ports + stores. One method = one user intention. Never subscribes to stores.             |
| **Reactors**         | Cross-cutting reactive side effects                                      | Observes store state → calls service. Never writes to stores directly. All registered in `reactors/index.ts`. |
| **Action Registry**  | Discoverable, triggerable actions                                        | Maps action IDs to service calls. Used by UI, shortcuts, command palette, Tauri menu.                         |

### `src/lib/types`

- shared domain and UI-safe types only

### `src/lib/utils`

- pure, domain-agnostic utility functions
- no business logic or domain knowledge
- no imports of domain types (NoteMeta, NotePath, etc.)
- stores can import from utils
- examples: `format_bytes`, `count_words`, `error_message`, `parent_folder_path`

### `src/lib/domain`

- domain-aware utility functions with business logic
- works with domain types (NoteMeta, NotePath, etc.)
- contains domain rules and transformations
- stores cannot import from domain
- examples: `extract_note_title`, `wiki_link`, `sanitize_note_name`, `search_query_parser`, `note_path_exists`, `default_hotkeys`

### `src/lib/ports`

- interface contracts for IO boundaries only

### `src/lib/adapters`

- concrete tauri/test implementations of ports (e.g. `editor/`, `tauri/`, `shared/`, `test/`)

### `src/lib/db`

- search schema and query constants (SQL, BM25 weights)
- used by search adapters for FTS index

### `src/lib/stores`

- synchronous app state classes
- can import from `utils` (pure utilities)
- cannot import from `domain` (business logic)

### `src/lib/services`

- async use-case orchestration
- IO via ports only
- writes state via domain store + `op_store` methods only
- never imports `ui_store`; UI orchestration stays in actions/components

### `src/lib/reactors`

- persistent observers (`$effect.root`) for cross-cutting side effects
- must not directly mutate stores
- call services or pure utilities instead

### `src/lib/actions`

- typed action IDs + registry + domain registration modules
- central place for user-triggerable intents (clicks, shortcuts, palette, menu equivalents)
- owns cross-cutting UI workflow state (dialogs, pending flags, selection state) driven by service outcomes

### `src/lib/components`

- render from stores
- trigger behavior via `action_registry.execute(...)`
- no direct port or adapter usage

### `src/lib/di` + `src/lib/context`

- composition root and context provision
- wire ports, stores, services, actions, reactors

## Folder structure

### Frontend (`src/`)

```
src/
├── lib/
│   ├── types/           # Shared domain and UI-safe types
│   ├── ports/           # Interface contracts for IO boundaries
│   ├── adapters/        # Concrete tauri/test implementations (editor/, tauri/, shared/, test/)
│   ├── db/              # Search schema and query constants
│   ├── stores/          # Synchronous app state classes
│   ├── services/        # Async use-case orchestration
│   ├── reactors/        # Persistent observers; index.ts registers all
│   ├── actions/         # Action registry + per-domain action registrations
│   ├── components/      # App Svelte components (pages, panels, modals)
│   ├── di/              # Composition root
│   ├── context/         # Context provision (app_context.svelte)
│   ├── hooks/           # Shared hooks (keyboard shortcuts, external links)
│   ├── domain/          # Domain-aware utilities
│   ├── utils/           # Pure, domain-agnostic utilities
│   └── ...
├── routes/              # Entrypoint (+page.svelte)
└── ...
```

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── lib.rs               # Module declarations + pub fn run() entry point
├── main.rs              # Binary entry point
├── app/
│   └── mod.rs           # Tauri builder, plugin registration, command handler wiring
├── features/
│   ├── mod.rs           # Re-exports all feature modules
│   ├── vault/           # Vault registry: open, list, register, remove
│   ├── notes/           # Note CRUD: list, read, write, create, rename, delete
│   ├── search/          # FTS index: build, rebuild, search, suggest, upsert, remove
│   │   ├── db.rs        # SQLite FTS schema and query constants
│   │   ├── model.rs     # Search domain types (IndexNoteMeta, SearchHit, SearchScope)
│   │   └── service.rs   # Tauri command handlers + SearchDbState managed state
│   ├── settings/        # App-level settings: get/set
│   ├── vault_settings/  # Per-vault settings: get/set
│   ├── git/             # Git operations: init, status, commit, log, diff, restore, tag
│   └── watcher/         # Filesystem watcher: watch/unwatch vault + WatcherState managed state
├── shared/
│   ├── constants.rs     # Excluded folder names (APP_DIR, GIT_DIR)
│   └── storage.rs       # Vault registry persistence (Vault, VaultStore), asset request handler
└── tests/
    └── mod.rs           # Integration test modules linked via #[path] to top-level tests/
```

## Backend architecture (Rust / Tauri)

The backend is a Tauri native process. Its sole job is to expose native capabilities to the frontend via IPC commands. There is no service layer, no event bus, and no domain state management — those all live on the frontend.

### Module roles

| Module      | Responsibility                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| `app/`      | Composition root. Builds the Tauri app: registers plugins, managed state, and all command handlers.  |
| `features/` | One sub-module per capability domain. Each feature owns its command handlers and any managed state.  |
| `shared/`   | Cross-feature utilities: vault registry persistence, path helpers, constants, asset request handler. |
| `tests/`    | Integration test entry points, linked to the top-level `tests/` directory via `#[path]`.             |

### Feature module pattern

Each feature is a module under `features/` with a consistent layout:

```
features/<name>/
├── mod.rs       # Module declarations (pub mod service; etc.)
└── service.rs   # #[tauri::command] handlers
```

Richer features add domain types and persistence alongside:

```
features/search/
├── mod.rs
├── db.rs        # SQLite FTS schema + BM25 query constants
├── model.rs     # Serializable domain types (IndexNoteMeta, SearchHit, SearchScope)
└── service.rs   # Command handlers + SearchDbState managed state
```

### Managed state

Stateful services (watcher, search index) use Tauri's `.manage()` system. State structs are declared in `service.rs` and registered in `app/mod.rs`:

```rust
.manage(features::watcher::service::WatcherState::default())
.manage(features::search::service::SearchDbState::default())
```

Commands receive state via Tauri's dependency injection:

```rust
#[tauri::command]
pub async fn watch_vault(state: tauri::State<'_, WatcherState>, ...) { ... }
```

### Shared storage

`shared/storage.rs` owns the vault registry (a JSON file at `<app_config_dir>/jotter/vaults.json`). It also handles the `jotter-asset://` custom URI scheme for serving binary assets (images) from the vault filesystem directly to the WebView.

### Backend invariants

1. All native capabilities are exposed exclusively through `#[tauri::command]` functions. No direct channel bypasses.
2. Managed state structs live in the feature's `service.rs`. No global statics.
3. Cross-feature shared code (types, utilities) goes in `shared/`, not inside a feature module.
4. `app/mod.rs` is the only place that registers plugins, state, and command handlers.
5. Backend holds no domain state between calls (exception: `WatcherState` and `SearchDbState` which are explicit lifecycle-managed service state).

## Decision tree: where does new code go?

```
START
  │
  ├─ Is it IO? (file, IPC, native API)
  │    └─ Port interface + Adapter
  │
  ├─ Persistent domain data?
  │    └─ Domain Store mutation
  │
  ├─ Ephemeral UI layout? (sidebar, modal, panel)
  │    └─ UIStore — component mutates directly, no service
  │
  ├─ Loading / error for an async op?
  │    └─ OpStore — service writes, component reads
  │
  ├─ User-triggerable action? (click, shortcut, menu)
  │    └─ ActionRegistry entry → calls service method
  │
  ├─ Async workflow with IO + store updates?
  │    └─ Service method
  │
  ├─ Store change must auto-trigger a side effect?
  │    └─ Reactor
  │
  ├─ Computed from existing state?
  │    └─ $derived in store or component
  │
  └─ Visual-only? (focus, scroll, animation)
       └─ Component-local $effect / $state
```

## Composition root

Entrypoint:

- `src/routes/+page.svelte` — app shell (uses `create_prod_ports`)

Bootstrap sequence:

1. Create production ports
2. Create app context (`create_app_context`) — registers actions and mounts reactors internally
3. Provide context (`provide_app_context`)
4. Render `AppShell`
5. Cleanup on destroy (`app.destroy()`)

## Invariants

1. All external IO goes through ports/adapters. No `invoke()` outside adapters.
2. Stores remain sync and side-effect free. Stores can import types and pure utilities from `utils`, but cannot import from `domain`.
3. Services never self-subscribe to store changes with `$effect`. Read yes, observe no — that's a reactor.
4. Reactors are the only persistent store observers that trigger side effects.
5. User-triggerable behavior is exposed through the action registry. Components never call services for side effects directly — use `action_registry.execute()`.
6. Components do not directly import services for side-effect execution.
7. No global singleton app instances; use context + composition root.
8. Services never import `UIStore`.
9. One truth per concern: ProseMirror owns live doc, stores own persisted state, OpStore owns operation state, UIStore owns layout state.

## Accepted deviations

**EditorService statefulness**: EditorService holds persistent session state (`session`, `host_root`, `active_note`, `active_link_syntax`, `session_generation`) because it manages a live DOM editor session. Exception to "services are stateless between method calls". The `session_generation` counter guards against race conditions analogous to AbortController.

**VaultService open lifecycle state**: VaultService stores `active_open_revision` and `index_progress_unsubscribe` to enforce "latest vault-open intent wins" and deterministic progress listener teardown. This state is lifecycle/cancellation bookkeeping only and must not contain domain data.

**SearchService request revisions**: SearchService stores per-use-case revision counters (`active_search_revision`, `active_wiki_suggest_revision`) to ignore stale async responses. This is cancellation bookkeeping only and must not hold domain state.

**Keyboard shortcuts**: Action definitions include `shortcut` metadata for UI display (e.g., command palette hints). Actual keyboard binding is imperative in `src/lib/hooks/use_keyboard_shortcuts.svelte.ts` for fine-grained control over event propagation and blocked-state checks. Intentional design choice.

**op_toast reactor**: Calls `svelte-sonner` toast functions directly instead of routing through a service. Toast notifications are fire-and-forget UI feedback with no store side effects, fitting the "pure runtime utilities" exception in reactor rule 3.

## Example: Rename Note

**Step 1 — Port** (`NotesPort.rename_note`)

**Step 2 — Store mutation**  
Domain store exposes `notes_store.rename_note(old_path, new_path)`.

**Step 3 — Service method**

```ts
async rename_note(note: NoteMeta, new_path: NotePath, overwrite: boolean) {
  const opKey = `note.rename:${note.id}`;
  this.op_store.start(opKey);
  try {
    await this.notes_port.rename_note(vault_id, note.path, new_path);
    this.notes_store.rename_note(note.path, new_path);
    this.op_store.succeed(opKey);
  } catch (e) {
    this.op_store.fail(opKey, error_message(e));
  }
}
```

**Step 4 — Action**  
Register in action registry: id `note.request_rename`, `note.confirm_rename`, etc. Component triggers `action_registry.execute('note.request_rename', note)`; modal reads `op_store`, calls service `rename_note()` on confirm.

**Step 5 — Reactor?**  
Only if a cross-cutting side effect is required (e.g. window title). Otherwise none.

Pattern: **Port → Store mutation → Service method → Action → Component.** Add a reactor only when a store change must auto-trigger a side effect.

## XState policy

XState is not part of the default architecture. If ever needed, it should be a local implementation detail inside a service method, not a top-level architectural layer.

## Layering lint guard

`pnpm lint:layering` enforces architecture constraints.

Current rules include:

- `components` cannot import ports/adapters/services/reactors
- `stores` cannot import ports/adapters/services/reactors/actions/components/domain and cannot use `async`/`await`
- `stores` can import from `utils` (pure utilities only)
- `services` cannot import adapters/components/reactors and cannot use `$effect`
- `services` cannot import `ui_store.svelte`
- `reactors` cannot import adapters/components and should not use inline `await`
- `actions` cannot import ports/adapters/components
- `routes` cannot import ports/services/stores/reactors/actions and should use context helpers

## Validation

Required before handoff:

- `pnpm check`
- `pnpm lint`
- `pnpm test`
- `cd src-tauri && cargo check`
