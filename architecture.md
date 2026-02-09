# Architecture

This is the source-of-truth architecture for Jotter.

## Core model

Jotter is built on five primary layers:

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

Rules:

- store methods are synchronous and deterministic
- no async/await in stores
- no imports from services, adapters, reactors, or UI components

### App UI state (`src/lib/stores/ui_store.svelte.ts`)

Owns ephemeral cross-screen UI state:

- dialogs
- palette/search panel state
- sidebar/filetree view state
- editor settings values used by UI

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

| Layer                | Responsibility                                | Rules                                                                                                         |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Ports & Adapters** | IO boundaries (fs, window, clipboard, search) | Port = interface. Adapter = factory fn. Services never import adapters — injected via constructor.            |
| **Stores**           | Reactive state (`$state` classes)             | Sync mutations only. No async. No imports of services/ports. Zero business logic.                             |
| **Services**         | Use cases (async workflows)                   | Constructor receives ports + stores. One method = one user intention. Never subscribes to stores.             |
| **Reactors**         | Cross-cutting reactive side effects           | Observes store state → calls service. Never writes to stores directly. All registered in `reactors/index.ts`. |
| **Action Registry**  | Discoverable, triggerable actions             | Maps action IDs to service calls. Used by UI, shortcuts, command palette, Tauri menu.                         |

### `src/lib/types`

- shared domain and UI-safe types only

### `src/lib/ports`

- interface contracts for IO boundaries only

### `src/lib/adapters`

- concrete web/tauri/test implementations of ports

### `src/lib/stores`

- synchronous app state classes

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

```
src/
├── lib/
│   ├── types/           # Shared domain and UI-safe types
│   ├── ports/           # Interface contracts for IO boundaries
│   ├── adapters/        # Concrete web/tauri/test implementations of ports (e.g. editor/)
│   ├── stores/          # Synchronous app state classes
│   ├── services/        # Async use-case orchestration
│   ├── reactors/        # Persistent observers; index.ts registers all
│   ├── actions/         # Action registry + per-domain action registrations
│   ├── components/      # App Svelte components (pages, panels, modals)
│   ├── di/              # Composition root
│   ├── context/         # Context provision
│   ├── hooks/           # Shared hooks (e.g. keyboard shortcuts)
│   ├── utils/           # Shared utilities
│   └── ...
├── routes/              # Entrypoints (+page.svelte, test/+page.svelte)
└── ...
```

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

Entrypoints:

- `src/routes/+page.svelte`
- `src/routes/test/+page.svelte`

Bootstrap sequence:

1. Create production/test ports
2. Create app context (`create_app_context`)
3. Register actions
4. Mount reactors
5. Provide context
6. Render `AppShell`
7. Cleanup on destroy

## Invariants

1. All external IO goes through ports/adapters. No `invoke()` outside adapters.
2. Stores remain sync and side-effect free. Stores never import anything except types.
3. Services never self-subscribe to store changes with `$effect`. Read yes, observe no — that's a reactor.
4. Reactors are the only persistent store observers that trigger side effects.
5. User-triggerable behavior is exposed through the action registry. Components never call services for side effects directly — use `action_registry.execute()`.
6. Components do not directly import services for side-effect execution.
7. No global singleton app instances; use context + composition root.
8. Services never import `UIStore`.
9. One truth per concern: ProseMirror owns live doc, stores own persisted state, OpStore owns operation state, UIStore owns layout state.

## Accepted deviations

**EditorService statefulness**: EditorService holds persistent session state (`session`, `host_root`, `active_note`, `active_link_syntax`, `session_generation`) because it manages a live DOM editor session. Exception to "services are stateless between method calls". The `session_generation` counter guards against race conditions analogous to AbortController.

**Keyboard shortcuts**: Action definitions include `shortcut` metadata for UI display (e.g., command palette hints). Actual keyboard binding is imperative in `src/lib/hooks/use_keyboard_shortcuts.svelte.ts` for fine-grained control over event propagation and blocked-state checks. Intentional design choice.

**op_toast reactor**: Calls `svelte-sonner` toast functions directly instead of routing through a service. Toast notifications are fire-and-forget UI feedback with no store side effects, fitting the "pure runtime utilities" exception in reactor rule 3.

## Example: Rename Note

**Step 1 — Port** (e.g. `FsPort.rename`)

**Step 2 — Store mutation**  
Domain store exposes something like `upsertNoteMetadata(note)`; reuse or add as needed.

**Step 3 — Service method**

```ts
async renameNote(id: string, newTitle: string) {
  const opKey = `note.rename:${id}`;
  this.op_store.start(opKey);
  try {
    const note = this.workspace.noteIndex.find(n => n.id === id);
    if (!note) throw new Error('Note not found');
    const newPath = `notes/${slugify(newTitle)}.md`;
    await this.fs.rename(note.path, newPath);
    this.workspace.upsertNoteMetadata({ ...note, title: newTitle, path: newPath });
    this.op_store.succeed(opKey);
  } catch (e) {
    this.op_store.fail(opKey, errorToMessage(e));
  }
}
```

**Step 4 — Action**  
Register in action registry: id, label, shortcut (e.g. F2), `when`, and `execute` (e.g. show rename modal). Component triggers `action_registry.execute('note.rename')`; modal reads `op_store`, calls service `renameNote()` on confirm.

**Step 5 — Reactor?**  
Only if a cross-cutting side effect is required (e.g. window title). Otherwise none.

Pattern: **Port → Store mutation → Service method → Action → Component.** Add a reactor only when a store change must auto-trigger a side effect.

## XState policy

XState is not part of the default architecture. If ever needed, it should be a local implementation detail inside a service method, not a top-level architectural layer.

## Layering lint guard

`pnpm lint:layering` enforces architecture constraints.

Current rules include:

- `components` cannot import ports/adapters/services/reactors
- `stores` cannot import ports/adapters/services/reactors/actions/components/utils and cannot use `async`/`await`
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
