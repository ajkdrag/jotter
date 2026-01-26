import { describe, expect, test } from 'vitest'
import { build_filetree, sort_tree } from '$lib/utils/filetree'
import type { NoteMeta } from '$lib/types/note'
import { as_note_path } from '$lib/types/ids'

function create_note(path: string, title: string = ''): NoteMeta {
  return {
    id: as_note_path(path),
    path: as_note_path(path),
    title: title || path.replace(/\.md$/, ''),
    mtime_ms: 0,
    size_bytes: 0
  }
}

describe('filetree', () => {
  test('leaf node is file when NoteMeta.path ends with .md', () => {
    const notes: NoteMeta[] = [
      create_note('note.md'),
      create_note('folder/note.md'),
      create_note('a/b/c/note.md')
    ]

    const tree = build_filetree(notes)

    expect(tree.children.get('note.md')?.isFolder).toBe(false)
    expect(tree.children.get('note.md')?.note).toBeTruthy()

    const folder = tree.children.get('folder')
    expect(folder?.isFolder).toBe(true)
    expect(folder?.children.get('note.md')?.isFolder).toBe(false)
    expect(folder?.children.get('note.md')?.note).toBeTruthy()

    const a = tree.children.get('a')
    const b = a?.children.get('b')
    const c = b?.children.get('c')
    expect(c?.isFolder).toBe(true)
    expect(c?.children.get('note.md')?.isFolder).toBe(false)
    expect(c?.children.get('note.md')?.note).toBeTruthy()
  })

  test('leaf node is file when it does not end with .md (defensive)', () => {
    const notes: NoteMeta[] = [
      create_note('note.txt'),
      create_note('folder/file')
    ]

    const tree = build_filetree(notes)

    expect(tree.children.get('note.txt')?.isFolder).toBe(false)
    expect(tree.children.get('note.txt')?.note).toBeTruthy()

    const folder = tree.children.get('folder')
    expect(folder?.isFolder).toBe(true)
    expect(folder?.children.get('file')?.isFolder).toBe(false)
    expect(folder?.children.get('file')?.note).toBeTruthy()
  })

  test('intermediate segments are always folders', () => {
    const notes: NoteMeta[] = [
      create_note('a/b/c/d/note.md')
    ]

    const tree = build_filetree(notes)

    const a = tree.children.get('a')
    expect(a?.isFolder).toBe(true)
    expect(a?.note).toBeNull()

    const b = a?.children.get('b')
    expect(b?.isFolder).toBe(true)
    expect(b?.note).toBeNull()

    const c = b?.children.get('c')
    expect(c?.isFolder).toBe(true)
    expect(c?.note).toBeNull()

    const d = c?.children.get('d')
    expect(d?.isFolder).toBe(true)
    expect(d?.note).toBeNull()

    const note = d?.children.get('note.md')
    expect(note?.isFolder).toBe(false)
    expect(note?.note).toBeTruthy()
  })

  test('sorting keeps folders before files', () => {
    const notes: NoteMeta[] = [
      create_note('zebra.md'),
      create_note('apple.md'),
      create_note('folder/note.md'),
      create_note('alpha/beta.md')
    ]

    const tree = sort_tree(build_filetree(notes))
    const entries = Array.from(tree.children.entries())

    expect(entries[0]?.[0]).toBe('alpha')
    expect(entries[0]?.[1].isFolder).toBe(true)

    expect(entries[1]?.[0]).toBe('folder')
    expect(entries[1]?.[1].isFolder).toBe(true)

    expect(entries[2]?.[0]).toBe('apple.md')
    expect(entries[2]?.[1].isFolder).toBe(false)

    expect(entries[3]?.[0]).toBe('zebra.md')
    expect(entries[3]?.[1].isFolder).toBe(false)
  })

  test('sorting within folders also keeps folders before files', () => {
    const notes: NoteMeta[] = [
      create_note('root/z-file.md'),
      create_note('root/a-file.md'),
      create_note('root/subfolder/note.md')
    ]

    const tree = sort_tree(build_filetree(notes))
    const root = tree.children.get('root')!
    const entries = Array.from(root.children.entries())

    expect(entries[0]?.[0]).toBe('subfolder')
    expect(entries[0]?.[1].isFolder).toBe(true)

    expect(entries[1]?.[0]).toBe('a-file.md')
    expect(entries[1]?.[1].isFolder).toBe(false)

    expect(entries[2]?.[0]).toBe('z-file.md')
    expect(entries[2]?.[1].isFolder).toBe(false)
  })

  test('handles empty notes array', () => {
    const tree = build_filetree([])
    expect(tree.children.size).toBe(0)
    expect(tree.isFolder).toBe(true)
  })

  test('handles root-level note', () => {
    const notes: NoteMeta[] = [create_note('root.md')]
    const tree = build_filetree(notes)

    expect(tree.children.get('root.md')?.isFolder).toBe(false)
    expect(tree.children.get('root.md')?.note).toBeTruthy()
  })
})
