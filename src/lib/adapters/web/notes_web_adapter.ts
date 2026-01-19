import type { NotesPort } from '$lib/ports/notes_port'
import { as_markdown_text, as_note_path, type MarkdownText, type NoteId, type NotePath, type VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'
import { get_vault } from './storage'

async function get_vault_handle(vault_id: VaultId): Promise<FileSystemDirectoryHandle> {
  const record = await get_vault(vault_id)
  if (!record) {
    throw new Error(`Vault not found: ${vault_id}`)
  }

  if ('requestPermission' in record.handle && typeof record.handle.requestPermission === 'function') {
    try {
      await (record.handle as { requestPermission: (opts: { mode: string }) => Promise<PermissionState> }).requestPermission({ mode: 'readwrite' })
    } catch (e) {
      throw new Error(`Permission denied for vault: ${vault_id}. ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return record.handle
}

async function resolve_note_path(
  root: FileSystemDirectoryHandle,
  note_path: NotePath
): Promise<{ handle: FileSystemHandle; parent: FileSystemDirectoryHandle; name: string }> {
  const parts = note_path.split('/').filter(Boolean)
  let current = root
  let name = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const is_last = i === parts.length - 1

    if (is_last) {
      name = part.endsWith('.md') ? part : `${part}.md`
      const handle = await current.getFileHandle(name, { create: false })
      return { handle, parent: current, name }
    } else {
      current = await current.getDirectoryHandle(part, { create: false })
    }
  }

  throw new Error(`Invalid note path: ${note_path}`)
}

async function list_markdown_files(
  dir: FileSystemDirectoryHandle,
  prefix: string = ''
): Promise<NoteMeta[]> {
  const notes: NoteMeta[] = []

  const entries: [string, FileSystemHandle][] = []
  for await (const [name, handle] of dir as any) {
    entries.push([name, handle])
  }

  for (const [name, handle] of entries) {
    if (handle.kind === 'file' && name.endsWith('.md')) {
      const file_handle = handle as FileSystemFileHandle
      const file = await file_handle.getFile()
      const full_path = prefix ? `${prefix}/${name}` : name
      const note_path = as_note_path(full_path.replace(/\.md$/, ''))

      notes.push({
        id: note_path,
        path: note_path,
        title: name.replace(/\.md$/, ''),
        mtime_ms: file.lastModified,
        size_bytes: file.size
      })
    } else if (handle.kind === 'directory') {
      const sub_prefix = prefix ? `${prefix}/${name}` : name
      const sub_notes = await list_markdown_files(handle as FileSystemDirectoryHandle, sub_prefix)
      notes.push(...sub_notes)
    }
  }

  return notes
}

export function create_notes_web_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId): Promise<NoteMeta[]> {
      const handle = await get_vault_handle(vault_id)
      return list_markdown_files(handle)
    },

    async read_note(vault_id: VaultId, note_id: NoteId): Promise<NoteDoc> {
      const root = await get_vault_handle(vault_id)
      const { handle, name } = await resolve_note_path(root, note_id)
      const file_handle = handle as FileSystemFileHandle
      const file = await file_handle.getFile()
      const markdown = as_markdown_text(await file.text())

      const note_path = as_note_path(note_id)
      const meta: NoteMeta = {
        id: note_path,
        path: note_path,
        title: name.replace(/\.md$/, ''),
        mtime_ms: file.lastModified,
        size_bytes: file.size
      }

      return { meta, markdown }
    },

    async write_note(vault_id: VaultId, note_id: NoteId, markdown: MarkdownText): Promise<void> {
      const root = await get_vault_handle(vault_id)
      const { handle, parent, name } = await resolve_note_path(root, note_id)
      const file_handle = handle as FileSystemFileHandle

      const writable = await file_handle.createWritable()
      await writable.write(markdown)
      await writable.close()
    },

    async create_note(vault_id: VaultId, note_path: NotePath, initial_markdown: MarkdownText): Promise<NoteMeta> {
      const root = await get_vault_handle(vault_id)
      const parts = note_path.split('/').filter(Boolean)
      let current = root
      let file_name = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) continue
        const is_last = i === parts.length - 1

        if (is_last) {
          file_name = part.endsWith('.md') ? part : `${part}.md`
          const file_handle = await current.getFileHandle(file_name, { create: true })
          const writable = await file_handle.createWritable()
          await writable.write(initial_markdown)
          await writable.close()

          const file = await file_handle.getFile()
          return {
            id: as_note_path(note_path),
            path: as_note_path(note_path),
            title: file_name.replace(/\.md$/, ''),
            mtime_ms: file.lastModified,
            size_bytes: file.size
          }
        } else {
          current = await current.getDirectoryHandle(part, { create: true })
        }
      }

      throw new Error(`Invalid note path: ${note_path}`)
    },

    async rename_note(vault_id: VaultId, from: NotePath, to: NotePath): Promise<void> {
      const root = await get_vault_handle(vault_id)
      const from_resolved = await resolve_note_path(root, from)
      const to_parts = to.split('/').filter(Boolean)
      let to_parent = root
      let to_name = ''

      for (let i = 0; i < to_parts.length; i++) {
        const part = to_parts[i]
        if (!part) continue
        const is_last = i === to_parts.length - 1

        if (is_last) {
          to_name = part.endsWith('.md') ? part : `${part}.md`
        } else {
          to_parent = await to_parent.getDirectoryHandle(part, { create: true })
        }
      }

      const from_file_handle = from_resolved.handle as FileSystemFileHandle
      const from_file = await from_file_handle.getFile()
      const to_file_handle = await to_parent.getFileHandle(to_name, { create: true })
      const writable = await to_file_handle.createWritable()
      await writable.write(await from_file.text())
      await writable.close()

      await from_resolved.parent.removeEntry(from_resolved.name)
    },

    async delete_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      const root = await get_vault_handle(vault_id)
      const { handle, parent, name } = await resolve_note_path(root, note_id)
      await parent.removeEntry(name)
    }
  }
}
