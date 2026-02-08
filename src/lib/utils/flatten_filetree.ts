import type { NoteMeta } from '$lib/types/note'
import type { FlatTreeNode, FolderLoadState } from '$lib/types/filetree'
import { build_filetree, sort_tree, type FileTreeNode } from '$lib/utils/filetree'

export type FlattenInput = {
  notes: NoteMeta[]
  folder_paths: string[]
  expanded_paths: Set<string>
  load_states: Map<string, FolderLoadState>
  error_messages: Map<string, string>
  show_hidden_files: boolean
}

export function flatten_filetree(input: FlattenInput): FlatTreeNode[] {
  const { notes, folder_paths, expanded_paths, load_states, error_messages, show_hidden_files } = input
  const tree = sort_tree(build_filetree(notes, folder_paths))
  const result: FlatTreeNode[] = []

  function visit(node: FileTreeNode, depth: number, parent_path: string | null) {
    for (const [, child] of node.children) {
      if (!show_hidden_files && child.name.startsWith('.')) {
        continue
      }

      const is_folder = child.is_folder
      const is_expanded = expanded_paths.has(child.path)
      const load_state = load_states.get(child.path) ?? 'unloaded'

      const flat_node: FlatTreeNode = {
        id: child.path,
        path: child.path,
        name: child.name,
        depth,
        is_folder,
        is_expanded,
        is_loading: load_state === 'loading',
        has_error: load_state === 'error',
        error_message: error_messages.get(child.path) ?? null,
        note: child.note,
        parent_path
      }

      result.push(flat_node)

      if (is_folder && is_expanded) {
        visit(child, depth + 1, child.path)
      }
    }
  }

  visit(tree, 0, null)
  return result
}
