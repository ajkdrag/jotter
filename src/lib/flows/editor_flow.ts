import { setup, assign, fromPromise } from 'xstate'
import type { EditorRuntime, EditorFlushResult } from '$lib/shell/editor_runtime'
import type { EditorFlowEvent } from '$lib/events/editor_flow_event'
import type { OpenNoteState } from '$lib/types/editor'
import type { EditorSettings } from '$lib/types/editor_settings'

type FlowContext = {
  runtime: EditorRuntime
  root: HTMLDivElement | null
  note: OpenNoteState | null
  pending_note: OpenNoteState | null
  link_syntax: EditorSettings['link_syntax']
  last_flush: EditorFlushResult | null
  flush_revision: number
  error: string | null
}

export type EditorFlowContext = FlowContext
export type EditorFlowEvents = EditorFlowEvent

type FlowInput = {
  runtime: EditorRuntime
}

export const editor_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as EditorFlowEvent,
    input: {} as FlowInput
  },
  actors: {
    perform_mount: fromPromise(
      async ({
        input
      }: {
        input: {
          runtime: EditorRuntime
          root: HTMLDivElement
          note: OpenNoteState
          link_syntax: EditorSettings['link_syntax']
        }
      }) => {
        await input.runtime.mount({
          root: input.root,
          note: input.note,
          link_syntax: input.link_syntax
        })
      }
    ),
    perform_flush: fromPromise(
      ({
        input
      }: {
        input: {
          runtime: EditorRuntime
        }
      }): Promise<EditorFlushResult | null> => {
        return Promise.resolve(input.runtime.flush())
      }
    )
  }
}).createMachine({
  id: 'editor_flow',
  initial: 'unmounted',
  context: ({ input }) => ({
    runtime: input.runtime,
    root: null,
    note: null,
    pending_note: null,
    link_syntax: 'wikilink',
    last_flush: null,
    flush_revision: 0,
    error: null
  }),
  on: {
    APPLY_SETTINGS: {
      actions: assign({
        link_syntax: ({ event }) => event.settings.link_syntax
      })
    }
  },
  states: {
    unmounted: {
      on: {
        MOUNT_REQUESTED: {
          target: 'mounting',
          actions: assign(({ event }) => ({
            root: event.root,
            note: event.note,
            pending_note: null,
            link_syntax: event.link_syntax,
            error: null
          }))
        }
      }
    },
    mounting: {
      on: {
        OPEN_BUFFER: {
          actions: assign({
            pending_note: ({ event }) => event.note,
            link_syntax: ({ event }) => event.link_syntax
          })
        }
      },
      invoke: {
        src: 'perform_mount',
        input: ({ context }) => {
          if (!context.root) throw new Error('root required for mount')
          if (!context.note) throw new Error('note required for mount')
          return {
            runtime: context.runtime,
            root: context.root,
            note: context.note,
            link_syntax: context.link_syntax
          }
        },
        onDone: {
          target: 'ready',
          actions: [
            ({ context }) => {
              if (!context.pending_note) {
                context.runtime.focus()
                return
              }
              void context.runtime
                .open_buffer(context.pending_note, context.link_syntax)
                .finally(() => {
                  context.runtime.focus()
                })
            },
            assign({
              note: ({ context }) => context.pending_note ?? context.note,
              pending_note: () => null
            })
          ]
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    ready: {
      on: {
        OPEN_BUFFER: {
          actions: [
            assign({
              note: ({ event }) => event.note,
              pending_note: () => null,
              link_syntax: ({ event }) => event.link_syntax
            }),
            ({ context, event }) => {
              void context.runtime.open_buffer(event.note, event.link_syntax)
            }
          ]
        },
        APPLY_SETTINGS: {
          actions: [
            assign({
              link_syntax: ({ event }) => event.settings.link_syntax
            }),
            ({ context, event }) => {
              void context.runtime.apply_settings(event.settings)
            }
          ]
        },
        INSERT_TEXT: {
          actions: ({ context, event }) => {
            context.runtime.insert_text(event.text)
          }
        },
        MARK_CLEAN: {
          actions: ({ context }) => {
            context.runtime.mark_clean()
          }
        },
        FLUSH_REQUESTED: {
          target: 'flushing'
        },
        UNMOUNT_REQUESTED: {
          target: 'unmounted',
          actions: [
            ({ context }) => {
              context.runtime.unmount()
            },
            assign({
              root: () => null,
              note: () => null,
              pending_note: () => null
            })
          ]
        }
      }
    },
    flushing: {
      invoke: {
        src: 'perform_flush',
        input: ({ context }) => ({ runtime: context.runtime }),
        onDone: {
          target: 'ready',
          actions: assign(({ context, event }) => ({
            last_flush: event.output,
            flush_revision: context.flush_revision + 1
          }))
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    error: {
      on: {
        UNMOUNT_REQUESTED: {
          target: 'unmounted',
          actions: [
            ({ context }) => {
              context.runtime.unmount()
            },
            assign({
              root: () => null,
              note: () => null,
              pending_note: () => null
            })
          ]
        },
        MOUNT_REQUESTED: {
          target: 'mounting',
          actions: assign(({ event }) => ({
            root: event.root,
            note: event.note,
            pending_note: null,
            link_syntax: event.link_syntax,
            error: null
          }))
        }
      }
    }
  }
})
