import type { VaultPath } from "$lib/types/ids";
import type { ThemeMode } from "$lib/types/theme";
import type { EditorSettings } from "$lib/types/editor_settings";

export type VaultInitializeResult =
  | {
      status: "ready";
      theme: ThemeMode;
      has_vault: boolean;
      editor_settings: EditorSettings | null;
    }
  | {
      status: "error";
      theme: ThemeMode;
      error: string;
    };

export type VaultChoosePathResult =
  | {
      status: "selected";
      path: VaultPath;
    }
  | {
      status: "cancelled";
    }
  | {
      status: "failed";
      error: string;
    };

export type VaultOpenResult =
  | {
      status: "opened";
      editor_settings: EditorSettings;
    }
  | {
      status: "stale";
    }
  | {
      status: "failed";
      error: string;
    };

export type ThemeSetResult =
  | {
      status: "success";
    }
  | {
      status: "failed";
      error: string;
    };
