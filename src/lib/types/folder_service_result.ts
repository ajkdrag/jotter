export type FolderMutationResult =
  | {
      status: 'success'
    }
  | {
      status: 'skipped'
    }
  | {
      status: 'failed'
      error: string
    }

export type FolderDeleteStatsResult =
  | {
      status: 'ready'
      affected_note_count: number
      affected_folder_count: number
    }
  | {
      status: 'skipped'
    }
  | {
      status: 'failed'
      error: string
    }

export type FolderLoadResult =
  | {
      status: 'loaded'
    }
  | {
      status: 'stale'
    }
  | {
      status: 'skipped'
    }
  | {
      status: 'failed'
      error: string
    }
