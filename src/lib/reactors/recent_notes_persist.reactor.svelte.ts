import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { VaultService } from "$lib/services/vault_service";
import type { NoteMeta } from "$lib/types/note";
import type { VaultId } from "$lib/types/ids";

const RECENT_NOTES_PERSIST_DELAY_MS = 1000;

export function create_recent_notes_persist_reactor(
  notes_store: NotesStore,
  vault_store: VaultStore,
  vault_service: VaultService,
): () => void {
  let active_vault_id = vault_store.vault?.id ?? null;
  let last_saved_serialized: string | null = null;
  let pending_notes: NoteMeta[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function schedule_persist(vault_id: VaultId, recent_notes: NoteMeta[]) {
    const serialized = JSON.stringify(recent_notes);
    if (serialized === last_saved_serialized) return;
    pending_notes = recent_notes;

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      const notes = pending_notes;
      pending_notes = null;
      timer = null;
      if (!notes) return;
      void vault_service.save_recent_notes(vault_id, notes).then(() => {
        last_saved_serialized = JSON.stringify(notes);
      });
    }, RECENT_NOTES_PERSIST_DELAY_MS);
  }

  function flush_pending() {
    if (!active_vault_id || !pending_notes) {
      pending_notes = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    const notes = pending_notes;
    pending_notes = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void vault_service.save_recent_notes(active_vault_id, notes).then(() => {
      last_saved_serialized = JSON.stringify(notes);
    });
  }

  return $effect.root(() => {
    $effect(() => {
      const vault_id = vault_store.vault?.id ?? null;
      const recent_notes = notes_store.recent_notes;

      if (vault_id !== active_vault_id) {
        flush_pending();
        active_vault_id = vault_id;
        last_saved_serialized = null;
      }

      if (!vault_id) return;
      schedule_persist(vault_id, recent_notes);
    });

    return () => {
      flush_pending();
    };
  });
}
