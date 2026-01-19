import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

function backup_path_for(note_path: string, at_ms: number): string {
  const parts = note_path.split('/')
  const file = parts.pop() ?? note_path
  const dir = parts.join('/')
  const stem = file.endsWith('.md') ? file.slice(0, -3) : file
  const ts = String(at_ms)
  const rel = dir.length > 0 ? `${dir}/` : ''
  return `.imdown/conflicts/${rel}${stem}.conflict.${ts}.md`
}

export function create_conflict_workflow() {
  return {
    async reload_from_disk() {
      const vault = app_state.vault
      const open = app_state.open_note
      if (!vault || !open) return
      const doc = await ports.notes.read_note(vault.id, open.meta.id)
      open.meta = doc.meta
      open.markdown = doc.markdown
      open.dirty = false
      open.last_saved_at_ms = Date.now()
      app_state.conflict = null
    },
    async keep_mine_with_backup() {
      const vault = app_state.vault
      const open = app_state.open_note
      if (!vault || !open) return

      const disk = await ports.notes.read_note(vault.id, open.meta.id)
      const backup_path = backup_path_for(open.meta.path, Date.now())
      await ports.notes.create_note(vault.id, as_note_path(backup_path), disk.markdown)

      await ports.notes.write_note(vault.id, open.meta.id, as_markdown_text(open.markdown))
      open.dirty = false
      open.last_saved_at_ms = Date.now()
      app_state.conflict = null
      void ports.index.build_index(vault.id)
    }
  }
}
