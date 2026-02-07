# Architecture

This is the source-of-truth architecture for Jotter.

## Core model

Jotter is built on five primary layers:

- Ports + adapters for all external IO boundaries
- `$state` store classes for app state
- Services for async use-case orchestration
- Reactors for persistent store observation side effects
- A typed action registry as the single dispatch surface for user-triggerable intents


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

1. All external IO goes through ports/adapters.
2. Stores remain sync and side-effect free.
3. Services never self-subscribe to store changes with `$effect`.
4. Reactors are the only persistent store observers that trigger side effects.
5. User-triggerable behavior is exposed through the action registry.
6. Components do not directly import services for side-effect execution.
7. No global singleton app instances; use context + composition root.
8. Services never import `UIStore`.

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
