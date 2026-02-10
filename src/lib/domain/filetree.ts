import type { NoteMeta } from "$lib/types/note";

export type FileTreeNode = {
  name: string;
  path: string;
  children: Map<string, FileTreeNode>;
  note: NoteMeta | null;
  is_folder: boolean;
};

export function build_filetree(
  notes: NoteMeta[],
  folder_paths: string[] = [],
): FileTreeNode {
  const root: FileTreeNode = {
    name: "",
    path: "",
    children: new Map(),
    note: null,
    is_folder: true,
  };

  for (const note of notes) {
    const parts = note.path.split("/").filter(Boolean);
    let current = root;
    let node_path = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const is_last = i === parts.length - 1;
      node_path = node_path ? `${node_path}/${part}` : part;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: node_path,
          children: new Map(),
          note: is_last ? note : null,
          is_folder: !is_last,
        });
      }
      const next = current.children.get(part);
      if (!next) throw new Error(`Missing node for part: ${part}`);
      if (is_last) {
        next.note = note;
        next.is_folder = false;
      }
      current = next;
    }
  }

  for (const rel_path of folder_paths) {
    const parts = rel_path.split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (!part) continue;
      const node_path = current.path ? `${current.path}/${part}` : part;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: node_path,
          children: new Map(),
          note: null,
          is_folder: true,
        });
      }
      const next_node = current.children.get(part);
      if (!next_node) throw new Error(`Missing node for part: ${part}`);
      current = next_node;
    }
  }

  return root;
}

export function sort_tree(node: FileTreeNode): FileTreeNode {
  const sorted_children = new Map<string, FileTreeNode>();
  const entries = Array.from(node.children.entries());

  entries.sort(([a_name, a_node], [b_name, b_node]) => {
    if (a_node.is_folder !== b_node.is_folder) {
      return a_node.is_folder ? -1 : 1;
    }
    return a_name.localeCompare(b_name);
  });

  for (const [name, child] of entries) {
    sorted_children.set(name, sort_tree(child));
  }

  return {
    ...node,
    children: sorted_children,
  };
}
