import type { EditorFlowHandle } from '$lib/flows/flush_editor'
import type { EditorFlushResult } from '$lib/shell/editor_runtime'

export function create_stub_editor_flow_handle(options?: {
  flush_result?: EditorFlushResult
  state?: string
}): EditorFlowHandle {
  const flush_result = options?.flush_result ?? null
  const state = options?.state ?? 'ready'
  let flush_revision = 0

  return {
    send: (event) => {
      if (event.type === 'FLUSH_REQUESTED') {
        flush_revision++
      }
    },
    get_snapshot: () => ({
      context: {
        runtime: {} as never,
        root: null,
        note: null,
        pending_note: null,
        link_syntax: 'wikilink' as const,
        last_flush: flush_result,
        flush_revision,
        error: null
      },
      matches: (s: string) => s === state
    }),
    subscribe: (listener) => {
      queueMicrotask(() => {
        flush_revision++
        listener({
          context: {
            runtime: {} as never,
            root: null,
            note: null,
            pending_note: null,
            link_syntax: 'wikilink' as const,
            last_flush: flush_result,
            flush_revision,
            error: null
          },
          matches: (s: string) => s === 'ready'
        })
      })
      return () => {}
    },
    stop: () => {}
  }
}
