import { setup } from 'xstate'
import type { ClipboardPort } from '$lib/ports/clipboard_port'
import { toast } from 'svelte-sonner'
import { logger } from '$lib/utils/logger'

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
              .then(() => {
                toast.success('Copied to clipboard')
              })
              .catch((error: unknown) => {
                logger.from_error('Clipboard write failed', error)
                toast.error('Failed to copy to clipboard')
              })
          }
        }
      }
    }
  }
})
