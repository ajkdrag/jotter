import { setup, assign, fromPromise } from "xstate";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { EditorSettings } from "$lib/types/editor_settings";
import type { VaultId } from "$lib/types/ids";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/types/editor_settings";
import {
  load_editor_settings,
  save_editor_settings,
} from "$lib/operations/load_editor_settings";
import { apply_editor_styles } from "$lib/operations/apply_editor_styles";
import type { AppStores } from "$lib/stores/create_app_stores";

type SettingsFlowPorts = {
  settings: SettingsPort;
  vault_settings: VaultSettingsPort;
};

type FlowContext = {
  ports: SettingsFlowPorts;
  stores: AppStores;
  current_settings: EditorSettings;
  has_unsaved_changes: boolean;
  error: string | null;
};

export type SettingsFlowContext = FlowContext;

type FlowEvents =
  | { type: "OPEN_DIALOG" }
  | { type: "CLOSE_DIALOG" }
  | { type: "UPDATE_SETTINGS"; settings: EditorSettings }
  | { type: "SAVE" }
  | { type: "RETRY" };

export type SettingsFlowEvents = FlowEvents;

type FlowInput = {
  ports: SettingsFlowPorts;
  stores: AppStores;
};

function get_vault_id(stores: AppStores): VaultId | null {
  return stores.vault.get_snapshot().vault?.id ?? null;
}

export const settings_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput,
  },
  actors: {
    load_settings: fromPromise(
      async ({ input }: { input: { ports: SettingsFlowPorts; stores: AppStores } }) => {
        const vault_id = get_vault_id(input.stores);
        if (!vault_id) {
          return DEFAULT_EDITOR_SETTINGS;
        }
        return await load_editor_settings(
          input.ports.vault_settings,
          vault_id,
          input.ports.settings
        );
      },
    ),
    save_settings: fromPromise(
      async ({
        input,
      }: {
        input: { ports: SettingsFlowPorts; stores: AppStores; settings: EditorSettings };
      }) => {
        const vault_id = get_vault_id(input.stores);
        if (!vault_id) {
          throw new Error("No vault open");
        }
        await save_editor_settings(input.ports.vault_settings, vault_id, input.settings);
        apply_editor_styles(input.settings);
      },
    ),
  },
}).createMachine({
  id: "settings_flow",
  initial: "idle",
  context: ({ input }) => ({
    ports: input.ports,
    stores: input.stores,
    current_settings: DEFAULT_EDITOR_SETTINGS,
    has_unsaved_changes: false,
    error: null,
  }),
  states: {
    idle: {
      on: {
        OPEN_DIALOG: "loading",
      },
    },
    loading: {
      invoke: {
        src: "load_settings",
        input: ({ context }) => ({ ports: context.ports, stores: context.stores }),
        onDone: {
          target: "editing",
          actions: [
            assign({
              current_settings: ({ event }) => event.output,
              has_unsaved_changes: false,
              error: null,
            }),
            ({ event, context }) => {
              context.stores.ui.actions.set_editor_settings(event.output)
              apply_editor_styles(event.output)
            }
          ],
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to load settings",
          }),
        },
      },
    },
    editing: {
      on: {
        UPDATE_SETTINGS: {
          actions: [
            assign({
              current_settings: ({ event }) => event.settings,
              has_unsaved_changes: true,
            }),
            ({ event, context }) => {
              context.stores.ui.actions.set_editor_settings(event.settings)
              apply_editor_styles(event.settings)
            },
          ],
        },
        SAVE: "saving",
        CLOSE_DIALOG: "idle",
      },
    },
    saving: {
      invoke: {
        src: "save_settings",
        input: ({ context }) => ({
          ports: context.ports,
          stores: context.stores,
          settings: context.current_settings,
        }),
        onDone: {
          target: "editing",
          actions: assign({
            has_unsaved_changes: false,
            error: null,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to save settings",
          }),
        },
      },
    },
    error: {
      on: {
        RETRY: "loading",
        CLOSE_DIALOG: "idle",
      },
    },
  },
});
