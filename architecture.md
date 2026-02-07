# Architecture & Design Bible

This is the source-of-truth architecture for Jotter.

## Core model

Jotter is built on:

- Hexagonal architecture (`ports` + `adapters`)
- Command/Event separation
- Event-driven reducers for persistent state
- Flow orchestration for transient UX state
- UI effects isolated from business logic

## Runtime loop

All write paths follow this loop:

1. UI dispatches an `AppCommand` to `command_bus`
2. Command handlers route to flows (or emit simple UI events)
3. Flows run use cases (IO through ports) and emit `AppEvent[]`
4. `event_bus` dispatches events to store reducers
5. UI rerenders from store snapshots
6. Runtime event routes coordinate flows/commands from events
7. Runtime UI effects react to events (toasts/DOM styling)

## Buses and contracts

### Command bus (`src/lib/commands`)

- `AppCommand` is the only mutation API for components/routes
- Command handlers are pure routers; invariants/context resolution lives in flows/use-cases
- Command handlers must not call ports/use cases directly

### Event bus (`src/lib/events`)

- Events are facts (`note_saved`, `open_note_set`, `ui_theme_set_failed`)
- Event bus always dispatches through reducers first, then subscribers
- Event bus subscribers are runtime routes/effects, not domain logic

### Runtime routes (`src/lib/runtime/attach_event_routes.ts`)

- Handles event→flow/command coordination (`vault_set`→`filetree_flow`, `note_saved`→`editor_flow`)
- Replaces store-reader closure orchestration
- Keeps flow coordination declarative and bus-driven

## State ownership

### Persistent state (reducers)

Owned by stores in `src/lib/stores`:

- `vault_store`
- `notes_store`
- `editor_store`
- `ui_store`

Rules:

- reducers are pure
- no async in stores
- no ports/use cases in stores

### Transient state (flows)

Owned by flows in `src/lib/flows`:

- dialogs, loading/error states, confirmation flows
- async orchestration and retries

Rules:

- flows orchestrate; use cases decide; reducers mutate state
- flows must not touch DOM or UI libs
- flows must not call ports directly (use use-cases)

### UI read model

`ui_store.runtime` is a projected read model of transient flow state.

- Components read transient UI state from stores (`ui_store.runtime`)
- Components do not read flow snapshots directly

## Layer responsibilities

### `types/`

- pure domain and UI-safe types

### `ports/`

- interfaces for external dependencies

### `adapters/`

- concrete IO/platform implementations

### `use_cases/`

- business IO via ports
- return `AppEvent[]`

### `flows/`

- XState orchestration
- invoke use cases
- dispatch returned events

### `commands/`

- command schema + command handlers
- command -> flow/event routing

### `runtime/`

- app runtime context for components
- flow-to-store runtime projection (`attach_ui_runtime_projection`)
- event-driven flow/command routes (`attach_event_routes`)
- event-driven UI effects (`attach_ui_effects`)

### `shell/`

- runtime implementations used by flows/effects (`editor_runtime`, style application)

### `components/`

- read state via store handles/context
- dispatch commands via command bus
- no direct flow `.send(...)`
- no direct `app.dispatch(...)`

## Composition root

Route entrypoints (`src/routes/+page.svelte`, `src/routes/test/+page.svelte`) must:

1. Create ports
2. Create stores
3. Create event bus
4. Create editor runtime
5. Create app flows
6. Create command bus
7. Attach command handlers
8. Attach runtime UI-state projection
9. Attach runtime event routes
10. Attach runtime UI effects
11. Render `AppShell` with `{ app, command_bus }`

## Non-negotiable constraints

- Components and routes must dispatch commands for mutations
- Components/routes must not send flow events directly
- Components/routes must not dispatch events directly
- Use cases must not import UI/store/flow/adapter/runtime layers
- Runtime effects must not contain business IO
- Stores must only change through reducer event handling

## Layering lint guard

`pnpm lint:layering` enforces the architecture contract.

Current strict checks include:

- `components` cannot import flows/controllers/ports/adapters/use_cases/xstate
- `components` cannot use `app.flows` or `app.dispatch`
- `routes` cannot use `app.flows.*.send(...)` or `app.dispatch(...)`
- `commands` cannot import use_cases/adapters/components/runtime/shell
- `flows` cannot import adapters/components/UI libs and cannot call ports directly
- `use_cases` cannot import runtime/store/flow/adapter/UI layers
- `stores` cannot contain async work or import runtime layers

## Validation

Required before handoff:

- `pnpm check`
- `pnpm lint`
- `pnpm test`
- `cd src-tauri && cargo check`
