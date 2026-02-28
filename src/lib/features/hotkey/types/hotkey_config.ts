export type HotkeyKey = string;

export type HotkeyPhase = "capture" | "bubble";

export type HotkeyCategory =
  | "general"
  | "navigation"
  | "tabs"
  | "git"
  | "editing";

export type HotkeyBinding = {
  action_id: string;
  key: HotkeyKey | null;
  phase: HotkeyPhase;
  label: string;
  description: string;
  category: HotkeyCategory;
  when?: string;
};

export type HotkeyConfig = {
  bindings: HotkeyBinding[];
};

export type HotkeyOverride = {
  action_id: string;
  key: HotkeyKey | null;
};

export type HotkeyConflict = {
  key: HotkeyKey;
  existing_action_id: string;
  existing_label: string;
};

export type HotkeyRecorderState = {
  open: boolean;
  action_id: string | null;
  current_key: HotkeyKey | null;
  pending_key: HotkeyKey | null;
  conflict: HotkeyConflict | null;
  error: string | null;
};
