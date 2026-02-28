import type { EditorSettings } from "$lib/shared/types/editor_settings";

export type SettingsLoadResult =
  | {
      status: "success";
      settings: EditorSettings;
    }
  | {
      status: "skipped";
      settings: EditorSettings;
    }
  | {
      status: "failed";
      settings: EditorSettings;
      error: string;
    };

export type SettingsSaveResult =
  | {
      status: "success";
    }
  | {
      status: "skipped";
    }
  | {
      status: "failed";
      error: string;
    };
