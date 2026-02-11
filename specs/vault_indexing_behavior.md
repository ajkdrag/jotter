# Vault Indexing Behavior

## Scope

This document defines the expected runtime behavior for vault indexing in Jotter.

## Scenarios

### 1. New vault open

- When a vault is opened for the first time in the session, the app shell remains interactive.
- Indexing starts in the background without blocking note browsing.
- Progress events are emitted while indexing is running.

### 2. Existing vault open

- Opening an existing vault triggers an incremental reconciliation sync.
- Only changed/added/removed notes are reconciled.
- Unchanged notes are not reindexed.

### 3. App-originated mutations

- App write actions immediately update index state:
- note save/create/rename triggers upsert or remove+upsert.
- note delete triggers remove.
- folder delete triggers remove-by-prefix.
- folder rename triggers path rewrite.

### 4. Mutations during sync

- If an index mutation command arrives while sync/rebuild is active:
- the active run is cancelled at a batch boundary.
- the mutation command still executes.
- a follow-up sync is queued automatically.
- completion is reported as `completed` with partial indexed count, not `failed`.

### 5. External filesystem changes

- Watcher events are treated as dirty signals.
- Any event for the active vault schedules a debounced sync.
- Multiple events inside the debounce window coalesce into one sync.

### 6. Stale search hits

- If opening a note from search fails with not-found:
- the stale path is removed from the index.
- the stale note metadata is removed from in-memory note store.
- the caller receives `not_found` so UI can show user feedback.

### 7. Manual reindex

- A user-triggered reindex action performs full rebuild.
- Rebuild restores index correctness even after prior inconsistencies.

## Correctness guarantees

- Indexing converges to on-disk truth after finite sync/rebuild runs.
- Cancelling in-progress indexing does not corrupt index tables.
- Rebuild is the recovery action and must be safe to invoke repeatedly.
