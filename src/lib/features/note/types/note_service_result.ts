import type { NotePath } from "$lib/shared/types/ids";

export type NoteOpenResult =
  | {
      status: "opened";
      selected_folder_path: string;
    }
  | {
      status: "skipped";
    }
  | {
      status: "not_found";
    }
  | {
      status: "failed";
      error: string;
    };

export type NoteDeleteResult =
  | {
      status: "deleted";
    }
  | {
      status: "skipped";
    }
  | {
      status: "failed";
      error: string;
    };

export type NoteRenameResult =
  | {
      status: "renamed";
    }
  | {
      status: "conflict";
    }
  | {
      status: "skipped";
    }
  | {
      status: "failed";
      error: string;
    };

export type NoteSaveResult =
  | {
      status: "saved";
      saved_path: NotePath;
    }
  | {
      status: "conflict";
    }
  | {
      status: "skipped";
    }
  | {
      status: "failed";
      error: string;
    };
