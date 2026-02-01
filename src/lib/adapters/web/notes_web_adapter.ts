import type { NotesPort } from '$lib/ports/notes_port'
import { as_markdown_text, as_note_path, type MarkdownText, type NoteId, type NotePath, type VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'
import type { FolderContents } from '$lib/types/filetree'
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

  for await (const handle of dir.values()) {
    if (handle.kind === 'file' && handle.name.endsWith('.md')) {
      const file_handle = handle as FileSystemFileHandle
      const file = await file_handle.getFile()
      const full_path = prefix ? `${prefix}/${handle.name}` : handle.name
      const note_path = as_note_path(full_path)

      notes.push({
        id: note_path,
        path: note_path,
        title: handle.name.replace(/\.md$/, ''),
        mtime_ms: file.lastModified,
        size_bytes: file.size
      })
    } else if (handle.kind === 'directory') {
      const sub_prefix = prefix ? `${prefix}/${handle.name}` : handle.name
      const sub_notes = await list_markdown_files(handle as FileSystemDirectoryHandle, sub_prefix)
      notes.push(...sub_notes)
    }
  }

  return notes
}

async function list_directory_paths(
  dir: FileSystemDirectoryHandle,
  prefix: string = ''
): Promise<string[]> {
  const paths: string[] = []

  for await (const handle of dir.values()) {
    if (handle.kind === 'directory') {
      const rel_path = prefix ? `${prefix}/${handle.name}` : handle.name
      paths.push(rel_path)
      const sub = await list_directory_paths(handle as FileSystemDirectoryHandle, rel_path)
      paths.push(...sub)
    }
  }

  return paths.sort((a, b) => a.localeCompare(b))
}

export function create_notes_web_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId): Promise<NoteMeta[]> {
      const handle = await get_vault_handle(vault_id)
      return list_markdown_files(handle)
    },

    async list_folders(vault_id: VaultId): Promise<string[]> {
      const handle = await get_vault_handle(vault_id)
      return list_directory_paths(handle)
    },

    async read_note(vault_id: VaultId, note_id: NoteId): Promise<NoteDoc> {
      const root = await get_vault_handle(vault_id)
      const { handle, name } = await resolve_note_path(root, note_id)
      const file_handle = handle as FileSystemFileHandle
      const file = await file_handle.getFile()
      const markdown = as_markdown_text(await file.text())

      const parts = note_id.split('/').filter(Boolean)
      const last_part = parts[parts.length - 1] || ''
      const full_name = last_part.endsWith('.md') ? last_part : `${last_part}.md`
      parts[parts.length - 1] = full_name
      const note_path = as_note_path(parts.join('/'))

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
      const { handle } = await resolve_note_path(root, note_id)
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
          const parts_with_md = [...parts]
          parts_with_md[parts_with_md.length - 1] = file_name
          const full_path = as_note_path(parts_with_md.join('/'))
          return {
            id: full_path,
            path: full_path,
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

    async create_folder(vault_id: VaultId, parent_path: string, folder_name: string): Promise<void> {
      const root = await get_vault_handle(vault_id)
      let current = root
      const parts = parent_path ? parent_path.split('/').filter(Boolean) : []
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: false })
      }
      await current.getDirectoryHandle(folder_name, { create: true })
    },

    async rename_note(vault_id: VaultId, from: NotePath, to: NotePath): Promise<void> {
      const root = await get_vault_handle(vault_id)

      const normalize = (path: NotePath) => {
        const parts = path.split('/').filter(Boolean)
        if (parts.length === 0) throw new Error(`Invalid note path: ${path}`)
        const last_index = parts.length - 1
        const last_part = parts[last_index]
        if (!last_part) throw new Error(`Invalid note path: ${path}`)
        const leaf = last_part.endsWith('.md') ? last_part : `${last_part}.md`
        parts[last_index] = leaf
        return { parts, leaf }
      }

      const from_norm = normalize(from)
      const to_norm = normalize(to)
      if (from_norm.parts.join('/') === to_norm.parts.join('/')) return

      const from_resolved = await resolve_note_path(root, as_note_path(from_norm.parts.join('/')))

      let to_parent = root
      for (let i = 0; i < to_norm.parts.length - 1; i++) {
        const part = to_norm.parts[i]
        if (!part) continue
        to_parent = await to_parent.getDirectoryHandle(part, { create: true })
      }
      const to_name = to_norm.leaf

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
      const { parent, name } = await resolve_note_path(root, note_id)
      await parent.removeEntry(name)
    },

    async list_folder_contents(vault_id: VaultId, folder_path: string): Promise<FolderContents> {
      const root = await get_vault_handle(vault_id)
      let target = root

      if (folder_path) {
        const parts = folder_path.split('/').filter(Boolean)
        for (const part of parts) {
          target = await target.getDirectoryHandle(part, { create: false })
        }
      }

      const notes: NoteMeta[] = []
      const subfolders: string[] = []

      for await (const handle of target.values()) {
        if (handle.kind === 'file' && handle.name.endsWith('.md')) {
          const file_handle = handle as FileSystemFileHandle
          const file = await file_handle.getFile()
          const full_path = folder_path ? `${folder_path}/${handle.name}` : handle.name
          const note_path = as_note_path(full_path)

          notes.push({
            id: note_path,
            path: note_path,
            title: handle.name.replace(/\.md$/, ''),
            mtime_ms: file.lastModified,
            size_bytes: file.size
          })
        } else if (handle.kind === 'directory') {
          const subfolder_path = folder_path ? `${folder_path}/${handle.name}` : handle.name
          subfolders.push(subfolder_path)
        }
      }

      notes.sort((a, b) => a.path.localeCompare(b.path))
      subfolders.sort((a, b) => a.localeCompare(b))

      return { notes, subfolders }
    }
  }
}
