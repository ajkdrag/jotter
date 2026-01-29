import { setup, assign, fromPromise } from "xstate";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { EditorSettings } from "$lib/types/editor_settings";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/types/editor_settings";
import {
  load_editor_settings,
  save_editor_settings,
} from "$lib/operations/load_editor_settings";
import { apply_editor_styles } from "$lib/operations/apply_editor_styles";

type SettingsFlowPorts = {
  settings: SettingsPort;
};

type FlowContext = {
  ports: SettingsFlowPorts;
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
};

export const settings_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput,
  },
  actors: {
    load_settings: fromPromise(
      async ({ input }: { input: { ports: SettingsFlowPorts } }) => {
        return await load_editor_settings(input.ports.settings);
      },
    ),
    save_settings: fromPromise(
      async ({
        input,
      }: {
        input: { ports: SettingsFlowPorts; settings: EditorSettings };
      }) => {
        await save_editor_settings(input.ports.settings, input.settings);
        apply_editor_styles(input.settings);
      },
    ),
  },
}).createMachine({
  id: "settings_flow",
  initial: "idle",
  context: ({ input }) => ({
    ports: input.ports,
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
        input: ({ context }) => ({ ports: context.ports }),
        onDone: {
          target: "editing",
          actions: assign({
            current_settings: ({ event }) => event.output,
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
            ({ event }) => apply_editor_styles(event.settings),
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
