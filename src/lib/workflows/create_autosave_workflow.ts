import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { as_markdown_text } from '$lib/types/ids'
import { save_note } from '$lib/operations/save_note'

export function create_autosave_workflow() {
  let pending: string | null = null
  let timer: number | null = null

  async function flush_inner() {
    const vault = app_state.vault
    const open = app_state.open_note
    if (!vault || !open) return
    const text = pending ?? open.markdown
    pending = null
    await save_note(
      { notes: ports.notes },
      { vault_id: vault.id, note_id: open.meta.id, markdown: as_markdown_text(text) }
    )
    open.dirty = false
    open.last_saved_at_ms = Date.now()
  }

  return {
    on_edit(markdown: string) {
      const open = app_state.open_note
      if (!open) return
      open.markdown = as_markdown_text(markdown)
      open.dirty = true
      pending = markdown
      if (timer != null) window.clearTimeout(timer)
      timer = window.setTimeout(() => flush_inner(), 800)
    },
    async flush() {
      if (timer != null) window.clearTimeout(timer)
      timer = null
      await flush_inner()
    }
  }
}

