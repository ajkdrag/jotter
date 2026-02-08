import type { NoteMeta } from '$lib/types/note'

export type FolderLoadState = 'unloaded' | 'loading' | 'loaded' | 'error'

export type FlatTreeNode = {
  id: string
  path: string
  name: string
  depth: number
  is_folder: boolean
  is_expanded: boolean
  is_loading: boolean
  has_error: boolean
  error_message: string | null
  note: NoteMeta | null
  parent_path: string | null
}

export type FolderContents = {
  notes: NoteMeta[]
  subfolders: string[]
}
