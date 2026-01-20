import { describe, expect, test } from 'vitest'
import { create_editor_session_workflow } from '$lib/workflows/create_editor_session_workflow'
import type { Vault } from '$lib/types/vault'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'

describe('editor_session_workflow', () => {
  test('does nothing without vault', () => {
    const state = {
      vault: null as Vault | null,
      notes: [] as NoteMeta[],
      open_note: null as OpenNoteState | null
    }

    const workflow = create_editor_session_workflow({ state, now: () => 123 })
    workflow.ensure_open_note()

    expect(state.open_note).toBe(null)
  })

  test('creates Untitled-1 when vault exists and open_note missing', () => {
    const state = {
      vault: {
        id: 'v' as VaultId,
        name: 'Vault',
        path: '/vault' as VaultPath,
        created_at: 0
      },
      notes: [] as NoteMeta[],
      open_note: null as OpenNoteState | null
    }

    const workflow = create_editor_session_workflow({ state, now: () => 1000 })
    workflow.ensure_open_note()

    expect(state.open_note?.meta.path).toBe('Untitled-1' as NotePath)
    expect(state.open_note?.markdown).toBe('' as any)
  })

  test('creates next Untitled-N based on existing notes', () => {
    const state = {
      vault: {
        id: 'v' as VaultId,
        name: 'Vault',
        path: '/vault' as VaultPath,
        created_at: 0
      },
      notes: [
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
      ] as NoteMeta[],
      open_note: null as OpenNoteState | null
    }

    const workflow = create_editor_session_workflow({ state, now: () => 1000 })
    workflow.ensure_open_note()

    expect(state.open_note?.meta.path).toBe('Untitled-3' as any)
  })

  test('does not overwrite existing open_note', () => {
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
      last_saved_at_ms: 0
    }

    const state = {
      vault: {
        id: 'v' as VaultId,
        name: 'Vault',
        path: '/vault' as VaultPath,
        created_at: 0
      },
      notes: [] as NoteMeta[],
      open_note: existing
    }

    const workflow = create_editor_session_workflow({ state, now: () => 1000 })
    workflow.ensure_open_note()

    expect(state.open_note).toBe(existing)
  })
})
