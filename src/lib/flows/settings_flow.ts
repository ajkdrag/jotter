import { setup, assign, fromPromise } from "xstate";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { EditorSettings } from "$lib/types/editor_settings";
import type { VaultId } from "$lib/types/ids";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/types/editor_settings";
import { load_editor_settings_use_case } from "$lib/use_cases/load_editor_settings_use_case";
import { save_editor_settings_use_case } from "$lib/use_cases/save_editor_settings_use_case";
import type { AppStores } from "$lib/stores/create_app_stores";
import type { AppEvent } from "$lib/events/app_event";

type SettingsFlowPorts = {
  settings: SettingsPort;
  vault_settings: VaultSettingsPort;
};

type FlowContext = {
  ports: SettingsFlowPorts;
  stores: AppStores;
  dispatch_many: (events: AppEvent[]) => void;
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
  dispatch_many: (events: AppEvent[]) => void;
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
          return [{ type: "ui_editor_settings_set", settings: DEFAULT_EDITOR_SETTINGS }] as AppEvent[];
        }
        return await load_editor_settings_use_case(
          { vault_settings: input.ports.vault_settings, settings: input.ports.settings },
          { vault_id }
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
        return await save_editor_settings_use_case(
          { vault_settings: input.ports.vault_settings },
          { vault_id, settings: input.settings }
        );
      },
    ),
  },
}).createMachine({
  id: "settings_flow",
  initial: "idle",
  context: ({ input }) => ({
    ports: input.ports,
    stores: input.stores,
    dispatch_many: input.dispatch_many,
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
              current_settings: ({ event }) => {
                const updated = event.output.find((e) => e.type === "ui_editor_settings_set");
                return updated ? updated.settings : DEFAULT_EDITOR_SETTINGS;
              },
              has_unsaved_changes: false,
              error: null,
            }),
            ({ event, context }) => {
              context.dispatch_many(event.output)
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
              context.dispatch_many([{ type: "ui_editor_settings_set", settings: event.settings }])
            }
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
          actions: [
            assign({
              has_unsaved_changes: false,
              error: null,
            }),
            ({ event, context }) => {
              context.dispatch_many(event.output)
            }
          ],
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
