import type { OpenNoteState } from "$lib/shared/types/editor";

export type ActivePane = "primary" | "secondary";

export class SplitViewStore {
  active = $state(false);
  secondary_note = $state<OpenNoteState | null>(null);
  active_pane = $state<ActivePane>("primary");

  open_secondary(note: OpenNoteState) {
    this.active = true;
    this.secondary_note = note;
    this.active_pane = "secondary";
  }

  close() {
    this.active = false;
    this.secondary_note = null;
    this.active_pane = "primary";
  }

  set_active_pane(pane: ActivePane) {
    this.active_pane = pane;
  }
}
