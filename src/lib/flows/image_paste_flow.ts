import { setup, assign, fromPromise } from 'xstate'
import type { AssetsPort } from '$lib/ports/assets_port'
import type { EditorPort } from '$lib/ports/editor_port'
import type { VaultId, NoteId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import type { ImagePasteData } from '$lib/types/image_paste'
import { insert_pasted_image } from '$lib/operations/insert_pasted_image'

type ImagePastePorts = {
  assets: AssetsPort
  editor: EditorPort
}

type FlowContext = {
  image_data: ImagePasteData | null
  custom_name: string
  attachments_folder: string
  vault_id: VaultId | null
  note_id: NoteId | null
  error: string | null
  result_markdown: string | null
  ports: ImagePastePorts
  stores: AppStores
}

export type ImagePasteFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_PASTE'; data: ImagePasteData; vault_id: VaultId; note_id: NoteId; attachments_folder: string }
  | { type: 'UPDATE_NAME'; name: string }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type ImagePasteFlowEvents = FlowEvents

type FlowInput = {
  ports: ImagePastePorts
  stores: AppStores
}

function default_name_from_file(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') return 'image'
  const match = trimmed.match(/^(.*)\.[a-z0-9]+$/i)
  return match?.[1] && match[1].trim() !== '' ? match[1].trim() : trimmed
}

export const image_paste_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    save_image: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: ImagePastePorts
          vault_id: VaultId
          attachments_folder: string
          image_data: ImagePasteData
          custom_name: string
        }
      }) => {
        return await insert_pasted_image(
          { assets: input.ports.assets },
          {
            vault_id: input.vault_id,
            attachments_folder: input.attachments_folder,
            source: {
              kind: 'bytes',
              bytes: input.image_data.original_bytes,
              file_name: input.image_data.original_name
            },
            display_name: input.custom_name,
            mime_type: input.image_data.mime_type
          }
        )
      }
    )
  }
}).createMachine({
  id: 'image_paste_flow',
  initial: 'idle',
  context: ({ input }) => ({
    image_data: null,
    custom_name: '',
    attachments_folder: '',
    vault_id: null,
    note_id: null,
    error: null,
    result_markdown: null,
    ports: input.ports,
    stores: input.stores
  }),
  states: {
    idle: {
      entry: assign({
        image_data: () => null,
        custom_name: () => '',
        attachments_folder: () => '',
        vault_id: () => null,
        note_id: () => null,
        error: () => null,
        result_markdown: () => null
      }),
      on: {
        REQUEST_PASTE: {
          target: 'configuring',
          actions: assign({
            image_data: ({ event }) => event.data,
            custom_name: ({ event }) => default_name_from_file(event.data.original_name),
            attachments_folder: ({ event }) => event.attachments_folder,
            vault_id: ({ event }) => event.vault_id,
            note_id: ({ event }) => event.note_id,
            error: () => null,
            result_markdown: () => null
          })
        }
      }
    },
    configuring: {
      on: {
        UPDATE_NAME: {
          actions: assign({
            custom_name: ({ event }) => event.name
          })
        },
        CONFIRM: 'saving',
        CANCEL: 'idle'
      }
    },
    saving: {
      invoke: {
        src: 'save_image',
        input: ({ context }) => {
          if (!context.vault_id) throw new Error('vault_id required in saving state')
          if (!context.image_data) throw new Error('image_data required in saving state')
          return {
            ports: context.ports,
            vault_id: context.vault_id,
            attachments_folder: context.attachments_folder,
            image_data: context.image_data,
            custom_name: context.custom_name
          }
        },
        onDone: {
          target: 'idle',
          actions: [
            assign({
              result_markdown: ({ event }) => event.output.markdown,
              error: () => null
            }),
            ({ context, event }) => {
              context.ports.editor.insert_text_at_cursor(event.output.markdown)
            }
          ]
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error)
          })
        }
      }
    },
    error: {
      on: {
        UPDATE_NAME: {
          actions: assign({
            custom_name: ({ event }) => event.name
          })
        },
        RETRY: 'saving',
        CANCEL: 'idle'
      }
    }
  }
})
