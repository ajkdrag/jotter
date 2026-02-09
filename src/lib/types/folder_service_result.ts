export type FolderMutationResult =
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

export type FolderDeleteStatsResult =
  | {
      status: "ready";
      affected_note_count: number;
      affected_folder_count: number;
    }
  | {
      status: "skipped";
    }
  | {
      status: "failed";
      error: string;
    };

export type FolderLoadResult =
  | {
      status: "stale";
    }
  | {
      status: "skipped";
    }
  | {
      status: "loaded";
      total_count: number;
      has_more: boolean;
    }
  | {
      status: "failed";
      error: string;
    };
