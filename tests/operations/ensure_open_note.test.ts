import { describe, expect, test } from 'vitest'
import { ensure_open_note } from '$lib/operations/ensure_open_note'
import type { Vault } from '$lib/types/vault'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'

describe('ensure_open_note', () => {
  test('does nothing without vault', () => {
    const result = ensure_open_note({
      vault: null as Vault | null,
      notes: [] as NoteMeta[],
      open_note: null as OpenNoteState | null,
      now_ms: 123
    })

    expect(result).toBe(null)
  })

  test('creates Untitled-1 when vault exists and open_note missing', () => {
    const vault: Vault = {
      id: 'v' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    const result = ensure_open_note({
      vault,
      notes: [] as NoteMeta[],
      open_note: null as OpenNoteState | null,
      now_ms: 1000
    })

    expect(result?.meta.path).toBe('Untitled-1' as NotePath)
    expect(result?.markdown).toBe('' as any)
  })

  test('creates next Untitled-N based on existing notes', () => {
    const vault: Vault = {
      id: 'v' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    const notes: NoteMeta[] = [
      {
        id: 'Untitled-2' as any,
        path: 'Untitled-2' as any,
        title: 'Untitled-2',
        mtime_ms: 0,
        size_bytes: 0
      },
      {
        id: 'welcome.md' as any,
        path: 'welcome.md' as any,
        title: 'Welcome',
        mtime_ms: 0,
        size_bytes: 0
      }
    ]

    const result = ensure_open_note({
      vault,
      notes,
      open_note: null as OpenNoteState | null,
      now_ms: 1000
    })

    expect(result?.meta.path).toBe('Untitled-3' as any)
  })

  test('does not overwrite existing open_note', () => {
    const vault: Vault = {
      id: 'v' as VaultId,
      name: 'Vault',
      path: '/vault' as VaultPath,
      created_at: 0
    }

    const existing: OpenNoteState = {
      meta: {
        id: 'welcome.md' as any,
        path: 'welcome.md' as any,
        title: 'Welcome',
        mtime_ms: 0,
        size_bytes: 0
      },
      markdown: 'hello' as any,
      dirty: false,
      revision_id: 0,
      saved_revision_id: 0,
      sticky_dirty: false,
      last_saved_at_ms: 0
    }

    const result = ensure_open_note({
      vault,
      notes: [] as NoteMeta[],
      open_note: existing,
      now_ms: 1000
    })

    expect(result).toBe(existing)
  })
})

