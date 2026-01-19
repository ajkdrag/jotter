import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { as_note_path } from '$lib/types/ids'
import type { VaultId } from '$lib/types/ids'
import type { VaultFsEvent } from '$lib/types/events'

let stop: (() => void | Promise<void>) | null = null
let watching_vault: VaultId | null = null
let refresh_timer: number | null = null
let index_timer: number | null = null

async function refresh_notes(vault_id: VaultId) {
  const notes = await ports.notes.list_notes(vault_id)
  app_state.notes = notes
}

function schedule_index_rebuild(vault_id: VaultId) {
  if (index_timer != null) window.clearTimeout(index_timer)
  index_timer = window.setTimeout(() => {
    void ports.index.build_index(vault_id)
  }, 800)
}

async function handle_event(event: VaultFsEvent) {
  const vault = app_state.vault
  if (!vault) return
  if (event.vault_id !== vault.id) return

  if (event.type === 'note_added' || event.type === 'note_removed') {
    if (refresh_timer != null) window.clearTimeout(refresh_timer)
    refresh_timer = window.setTimeout(() => refresh_notes(vault.id), 250)
    schedule_index_rebuild(vault.id)
    return
  }

  if (event.type === 'note_changed_externally') {
    const open = app_state.open_note
    if (!open) return
    if (open.meta.path !== event.note_path) return
    if (open.dirty) {
      app_state.conflict = { note_path: event.note_path, seen_at_ms: Date.now() }
      schedule_index_rebuild(vault.id)
      return
    }
    const doc = await ports.notes.read_note(vault.id, as_note_path(event.note_path))
    open.meta = doc.meta
    open.markdown = doc.markdown
    open.dirty = false
    open.last_saved_at_ms = Date.now()
    schedule_index_rebuild(vault.id)
  }
}

export async function ensure_watching(vault_id: VaultId) {
  if (watching_vault === vault_id && stop) return

  if (stop) {
    await stop()
    stop = null
  }

  watching_vault = vault_id
  stop = await ports.watcher.watch_vault(vault_id, handle_event)
}

export async function stop_watching() {
  if (!stop) return
  await stop()
  stop = null
  watching_vault = null
}
