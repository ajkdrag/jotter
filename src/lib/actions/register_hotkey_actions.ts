import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { DEFAULT_HOTKEYS } from "$lib/domain/default_hotkeys";
import {
  is_valid_hotkey,
  is_reserved_key,
} from "$lib/domain/hotkey_validation";
import type { HotkeyOverride, HotkeyPhase } from "$lib/types/hotkey_config";

const CLOSED_HOTKEY_RECORDER = {
  open: false,
  action_id: null,
  current_key: null,
  pending_key: null,
  conflict: null,
  error: null,
} as const;

type OpenHotkeyEditorPayload = {
  action_id: string;
  current_key: string | null;
};

type SetHotkeyBindingPayload = {
  action_id: string;
  key: string;
  phase: HotkeyPhase;
  force?: boolean;
};

function upsert_override(
  overrides: HotkeyOverride[],
  override: HotkeyOverride,
): HotkeyOverride[] {
  const result = overrides.filter((o) => o.action_id !== override.action_id);
  result.push(override);
  return result;
}

function apply_draft(
  input: ActionRegistrationInput,
  overrides: HotkeyOverride[],
) {
  const { stores, services } = input;
  const draft_config = services.hotkey.merge_config(DEFAULT_HOTKEYS, overrides);
  stores.ui.settings_dialog = {
    ...stores.ui.settings_dialog,
    hotkey_draft_overrides: overrides,
    hotkey_draft_config: draft_config,
  };
}

function parse_open_editor_payload(payload: unknown): OpenHotkeyEditorPayload {
  const record = (payload ?? {}) as Record<string, unknown>;
  return {
    action_id: typeof record.action_id === "string" ? record.action_id : "",
    current_key:
      typeof record.current_key === "string" ? record.current_key : null,
  };
}

function parse_set_binding_payload(payload: unknown): SetHotkeyBindingPayload {
  const record = (payload ?? {}) as Record<string, unknown>;
  return {
    action_id: typeof record.action_id === "string" ? record.action_id : "",
    key: typeof record.key === "string" ? record.key : "",
    phase: (record.phase as HotkeyPhase) ?? "capture",
    force: Boolean(record.force),
  };
}

function set_recorder_validation_error(
  input: ActionRegistrationInput,
  error: string,
) {
  input.stores.ui.hotkey_recorder = {
    ...input.stores.ui.hotkey_recorder,
    error,
    conflict: null,
  };
}

export function register_hotkey_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  registry.register({
    id: ACTION_IDS.hotkey_open_editor,
    label: "Open Hotkey Editor",
    execute: (payload: unknown) => {
      const { action_id, current_key } = parse_open_editor_payload(payload);
      stores.ui.hotkey_recorder = {
        open: true,
        action_id,
        current_key,
        pending_key: current_key,
        conflict: null,
        error: null,
      };
    },
  });

  registry.register({
    id: ACTION_IDS.hotkey_close_editor,
    label: "Close Hotkey Editor",
    execute: () => {
      stores.ui.hotkey_recorder = { ...CLOSED_HOTKEY_RECORDER };
    },
  });

  registry.register({
    id: ACTION_IDS.hotkey_set_binding,
    label: "Set Hotkey Binding",
    execute: (payload: unknown) => {
      const { action_id, key, phase, force } =
        parse_set_binding_payload(payload);
      if (!action_id || !key) {
        return;
      }

      const validation = is_valid_hotkey(key);
      if (!validation.valid) {
        set_recorder_validation_error(
          input,
          validation.error ?? "Invalid hotkey",
        );
        return;
      }

      if (is_reserved_key(key)) {
        set_recorder_validation_error(
          input,
          "This hotkey is reserved by the system",
        );
        return;
      }

      const draft_config = stores.ui.settings_dialog.hotkey_draft_config;
      const conflict = services.hotkey.detect_conflict(
        key,
        phase,
        action_id,
        draft_config,
      );

      if (conflict && !force) {
        stores.ui.hotkey_recorder = {
          ...stores.ui.hotkey_recorder,
          pending_key: key,
          conflict,
          error: null,
        };
        return;
      }

      let overrides = [...stores.ui.settings_dialog.hotkey_draft_overrides];

      if (conflict) {
        overrides = upsert_override(overrides, {
          action_id: conflict.existing_action_id,
          key: null,
        });
      }

      overrides = upsert_override(overrides, { action_id, key });

      apply_draft(input, overrides);

      void registry.execute(ACTION_IDS.hotkey_close_editor);
    },
  });

  registry.register({
    id: ACTION_IDS.hotkey_clear_binding,
    label: "Clear Hotkey Binding",
    execute: (action_id: unknown) => {
      if (typeof action_id !== "string") {
        return;
      }
      const overrides = upsert_override(
        [...stores.ui.settings_dialog.hotkey_draft_overrides],
        { action_id, key: null },
      );
      apply_draft(input, overrides);
    },
  });

  registry.register({
    id: ACTION_IDS.hotkey_reset_all,
    label: "Reset All Hotkeys",
    execute: () => {
      apply_draft(input, []);
    },
  });

  registry.register({
    id: ACTION_IDS.hotkey_reset_single,
    label: "Reset Single Hotkey",
    execute: (action_id: unknown) => {
      if (typeof action_id !== "string") {
        return;
      }
      const overrides = stores.ui.settings_dialog.hotkey_draft_overrides.filter(
        (o) => o.action_id !== action_id,
      );
      apply_draft(input, overrides);
    },
  });
}
