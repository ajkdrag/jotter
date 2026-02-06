import { setup, fromPromise } from 'xstate'
import type { ClipboardPort } from '$lib/ports/clipboard_port'
import type { AppEvent } from '$lib/events/app_event'
import { write_clipboard_use_case } from '$lib/use_cases/write_clipboard_use_case'

type ClipboardFlowPorts = {
  clipboard: ClipboardPort
}

type FlowContext = {
  ports: ClipboardFlowPorts
  dispatch_many: (events: AppEvent[]) => void
}

export type ClipboardFlowContext = FlowContext

type FlowEvents = { type: 'COPY_TEXT'; text: string }

export type ClipboardFlowEvents = FlowEvents

type FlowInput = {
  ports: ClipboardFlowPorts
  dispatch_many: (events: AppEvent[]) => void
}

export const clipboard_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_copy: fromPromise(
      async ({
        input
      }: {
        input: { ports: ClipboardFlowPorts; text: string }
      }): Promise<AppEvent[]> => {
        return await write_clipboard_use_case(
          { clipboard: input.ports.clipboard },
          { text: input.text }
        )
      }
    )
  }
}).createMachine({
  id: 'clipboard_flow',
  initial: 'idle',
  context: ({ input }) => ({
    ports: input.ports,
    dispatch_many: input.dispatch_many
  }),
  states: {
    idle: {
      on: {
        COPY_TEXT: {
          target: 'copying'
        }
      }
    },
    copying: {
      invoke: {
        src: 'perform_copy',
        input: ({ context, event }) => {
          return {
            ports: context.ports,
            text: event.text
          }
        },
        onDone: {
          target: 'idle',
          actions: ({ context, event }) => {
            context.dispatch_many(event.output)
          }
        },
        onError: {
          target: 'idle'
        }
      }
    }
  }
})
