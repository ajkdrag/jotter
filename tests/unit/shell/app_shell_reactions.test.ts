import { describe, expect, it, vi } from 'vitest'
import { attach_shell_reactions, type ShellReactionReaders } from '$lib/shell/app_shell_reactions'
import { as_markdown_text, as_note_path, as_vault_id, as_vault_path } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'
import type { EventBus } from '$lib/events/event_bus'
import type { AppEvent } from '$lib/events/app_event'
import type { Vault } from '$lib/types/vault'

function create_open_note(): OpenNoteState {
  const path = as_note_path('note.md')
  return {
    meta: {
      id: path,
      path,
      title: 'note',
      mtime_ms: 0,
      size_bytes: 0
    },
    markdown: as_markdown_text(''),
    buffer_id: path,
    is_dirty: false
  }
}

function create_test_event_bus() {
  const listeners: Array<(event: AppEvent) => void> = []
  const event_bus: EventBus = {
    dispatch: vi.fn(),
    dispatch_many: vi.fn(),
    subscribe: (listener) => {
      listeners.push(listener)
      return () => {}
    }
  }
  return { event_bus, listeners }
}

function create_mock_flow_handle(): { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(),
    get_snapshot: vi.fn().mockReturnValue({ context: {}, matches: () => false }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    stop: vi.fn()
  } as never
}

function create_default_readers(overrides?: Partial<ShellReactionReaders>): ShellReactionReaders {
  return {
    get_link_syntax: () => 'wikilink',
    get_vault: () => null,
    get_open_note: () => null,
    ...overrides
  }
}

describe('attach_shell_reactions', () => {
  it('sends OPEN_BUFFER when open_note_set is dispatched', () => {
    const { event_bus, listeners } = create_test_event_bus()
    const editor_flow = create_mock_flow_handle()
    const open_note = create_open_note()
    const readers = create_default_readers({ get_link_syntax: () => 'markdown' })

    attach_shell_reactions({
      event_bus,
      editor_flow: editor_flow as never,
      open_note_flow: create_mock_flow_handle() as never,
      filetree_flow: create_mock_flow_handle() as never,
      readers
    })
    listeners[0]?.({ type: 'open_note_set', open_note })

    expect(editor_flow.send).toHaveBeenCalledWith({
      type: 'OPEN_BUFFER',
      note: open_note,
      link_syntax: 'markdown'
    })
  })

  it('sends OPEN_WIKI_LINK to open_note_flow when editor_wiki_link_clicked is dispatched', () => {
    const { event_bus, listeners } = create_test_event_bus()
    const vault: Vault = { id: as_vault_id('v1'), name: 'V', path: as_vault_path('/v'), created_at: 0 }
    const open_note_flow = create_mock_flow_handle()
    const readers = create_default_readers({ get_vault: () => vault })

    attach_shell_reactions({
      event_bus,
      editor_flow: create_mock_flow_handle() as never,
      open_note_flow: open_note_flow as never,
      filetree_flow: create_mock_flow_handle() as never,
      readers
    })
    listeners[0]?.({ type: 'editor_wiki_link_clicked', note_path: 'target.md' })

    expect(open_note_flow.send).toHaveBeenCalledWith({
      type: 'OPEN_WIKI_LINK',
      vault_id: vault.id,
      note_path: as_note_path('target.md')
    })
  })

  it('sends VAULT_CHANGED to filetree_flow when vault_set is dispatched', () => {
    const { event_bus, listeners } = create_test_event_bus()
    const filetree_flow = create_mock_flow_handle()
    const readers = create_default_readers()

    attach_shell_reactions({
      event_bus,
      editor_flow: create_mock_flow_handle() as never,
      open_note_flow: create_mock_flow_handle() as never,
      filetree_flow: filetree_flow as never,
      readers
    })
    const vault: Vault = { id: as_vault_id('v1'), name: 'V', path: as_vault_path('/v'), created_at: 0 }
    listeners[0]?.({ type: 'vault_set', vault })

    expect(filetree_flow.send).toHaveBeenCalledWith({ type: 'VAULT_CHANGED' })
  })
})
