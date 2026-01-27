import type { NoteMeta } from '$lib/types/note'

export type FileTreeNode = {
  name: string
  path: string
  children: Map<string, FileTreeNode>
  note: NoteMeta | null
  is_folder: boolean
}

export function build_filetree(notes: NoteMeta[]): FileTreeNode {
  const root: FileTreeNode = {
    name: '',
    path: '',
    children: new Map(),
    note: null,
    is_folder: true
  }

  for (const note of notes) {
    const parts = note.path.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      
      const is_last = i === parts.length - 1

      if (!current.children.has(part)) {
        const node_path = parts.slice(0, i + 1).join('/')
        current.children.set(part, {
          name: part,
          path: node_path,
          children: new Map(),
          note: is_last ? note : null,
          is_folder: !is_last
        })
      }

      const next_node = current.children.get(part)
      if (next_node) {
        current = next_node
      }
    }
  }

  return root
}

export function sort_tree(node: FileTreeNode): FileTreeNode {
  const sorted_children = new Map<string, FileTreeNode>()
  const entries = Array.from(node.children.entries())
  
  entries.sort(([a_name, a_node], [b_name, b_node]) => {
    if (a_node.is_folder !== b_node.is_folder) {
      return a_node.is_folder ? -1 : 1
    }
    return a_name.localeCompare(b_name)
  })

  for (const [name, child] of entries) {
    sorted_children.set(name, sort_tree(child))
  }

  return {
    ...node,
    children: sorted_children
  }
}
