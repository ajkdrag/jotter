import type { NoteMeta } from '$lib/types/note'

export type FileTreeNode = {
  name: string
  path: string
  children: Map<string, FileTreeNode>
  note: NoteMeta | null
  isFolder: boolean
}

export function build_filetree(notes: NoteMeta[]): FileTreeNode {
  const root: FileTreeNode = {
    name: '',
    path: '',
    children: new Map(),
    note: null,
    isFolder: true
  }

  for (const note of notes) {
    const parts = note.path.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      
      const isLast = i === parts.length - 1
      const isFile = isLast && part.endsWith('.md')

      if (!current.children.has(part)) {
        const nodePath = parts.slice(0, i + 1).join('/')
        current.children.set(part, {
          name: part,
          path: nodePath,
          children: new Map(),
          note: isLast ? note : null,
          isFolder: !isFile
        })
      }

      const nextNode = current.children.get(part)
      if (nextNode) {
        current = nextNode
      }
    }
  }

  return root
}

export function sort_tree(node: FileTreeNode): FileTreeNode {
  const sortedChildren = new Map<string, FileTreeNode>()
  const entries = Array.from(node.children.entries())
  
  entries.sort(([aName, aNode], [bName, bNode]) => {
    if (aNode.isFolder !== bNode.isFolder) {
      return aNode.isFolder ? -1 : 1
    }
    return aName.localeCompare(bName)
  })

  for (const [name, child] of entries) {
    sortedChildren.set(name, sort_tree(child))
  }

  return {
    ...node,
    children: sortedChildren
  }
}
