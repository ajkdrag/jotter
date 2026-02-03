import { setup } from 'xstate'
import type { ClipboardPort } from '$lib/ports/clipboard_port'

type ClipboardFlowPorts = {
  clipboard: ClipboardPort
}

type FlowContext = {
  ports: ClipboardFlowPorts
}

export type ClipboardFlowContext = FlowContext

type FlowEvents = { type: 'COPY_TEXT'; text: string }

export type ClipboardFlowEvents = FlowEvents

type FlowInput = {
  ports: ClipboardFlowPorts
}

export const clipboard_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  }
}).createMachine({
  id: 'clipboard_flow',
  initial: 'idle',
  context: ({ input }) => ({
    ports: input.ports
  }),
  states: {
    idle: {
      on: {
        COPY_TEXT: {
          actions: ({ context, event }) => {
            void context.ports.clipboard.write_text(event.text)
              .catch((error) => {
                console.error('Failed to copy text to clipboard:', error)
              })
          }
        }
      }
    }
  }
})
