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

- App write actions enqueue index changes via a per-vault actor.
- The actor reduces queued changes into a dirty workset.
- Workset operations run in the background and converge to on-disk truth.

### 4. Mutations during sync

- If new index changes arrive while a run is active:
- the active run completes its current checkpoint.
- one follow-up run is queued automatically.
- follow-up work is reduced to dirty paths/prefixes; unchanged files are not reindexed.

### 5. External filesystem changes

- Watcher events are treated as dirty signals.
- Note-specific events map to path-level dirty changes.
- Unknown or broad events map to `force_scan`.

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
