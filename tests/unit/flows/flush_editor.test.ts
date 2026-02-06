import { describe, it, expect } from 'vitest'
import { flush_editor } from '$lib/flows/flush_editor'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { EditorFlowHandle } from '$lib/flows/flush_editor'
import type { EditorFlowContext } from '$lib/flows/editor_flow'
import type { FlowSnapshot } from '$lib/flows/flow_handle'

function create_snapshot(
  state: string,
  overrides: Partial<EditorFlowContext> = {}
): FlowSnapshot<EditorFlowContext> {
  return {
    context: {
      runtime: {} as never,
      root: null,
      note: null,
      pending_note: null,
      link_syntax: 'wikilink',
      last_flush: null,
      flush_revision: 0,
      error: null,
      ...overrides
    },
    matches: (s: string) => s === state
  }
}

describe('flush_editor', () => {
  it('returns null for unmounted editor', async () => {
    const handle: EditorFlowHandle = {
      send: () => {},
      get_snapshot: () => create_snapshot('unmounted'),
      subscribe: () => () => {},
      stop: () => {}
    }

    const result = await flush_editor(handle)
    expect(result).toBeNull()
  })

  it('throws for editor in error state', async () => {
    const handle: EditorFlowHandle = {
      send: () => {},
      get_snapshot: () => create_snapshot('error', { error: 'bad' }),
      subscribe: () => () => {},
      stop: () => {}
    }

    await expect(flush_editor(handle)).rejects.toThrow('bad')
  })

  it('sends FLUSH_REQUESTED and waits for ready', async () => {
    const sent_events: string[] = []
    const flush_result = {
      note_id: as_note_path('n.md'),
      markdown: as_markdown_text('content')
    }

    let revision = 0
    const handle: EditorFlowHandle = {
      send: (event) => {
        sent_events.push(event.type)
        if (event.type === 'FLUSH_REQUESTED') revision = 1
      },
      get_snapshot: () => create_snapshot('ready', {
        flush_revision: revision,
        last_flush: revision > 0 ? flush_result : null
      }),
      subscribe: (listener) => {
        queueMicrotask(() => {
          listener(create_snapshot('ready', {
            flush_revision: 1,
            last_flush: flush_result
          }))
        })
        return () => {}
      },
      stop: () => {}
    }

    const result = await flush_editor(handle)
    expect(sent_events).toContain('FLUSH_REQUESTED')
    expect(result).toEqual(flush_result)
  })
})
