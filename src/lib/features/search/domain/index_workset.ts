import type { IndexChange } from "$lib/features/search/ports";

export type PrefixRename = {
  old_prefix: string;
  new_prefix: string;
};

export type PathRename = {
  old_path: string;
  new_path: string;
};

export type ReducedIndexWorkset = {
  upsert_paths: Set<string>;
  remove_paths: Set<string>;
  remove_prefixes: Set<string>;
  rename_paths: PathRename[];
  rename_prefixes: PrefixRename[];
  force_scan: boolean;
  force_rebuild: boolean;
};

function create_empty_workset(): ReducedIndexWorkset {
  return {
    upsert_paths: new Set<string>(),
    remove_paths: new Set<string>(),
    remove_prefixes: new Set<string>(),
    rename_paths: [],
    rename_prefixes: [],
    force_scan: false,
    force_rebuild: false,
  };
}

function remap_prefix(
  path: string,
  old_prefix: string,
  new_prefix: string,
): string {
  if (!path.startsWith(old_prefix)) {
    return path;
  }
  return `${new_prefix}${path.slice(old_prefix.length)}`;
}

function remap_set(
  paths: Set<string>,
  old_prefix: string,
  new_prefix: string,
): Set<string> {
  const remapped = new Set<string>();
  for (const path of paths) {
    remapped.add(remap_prefix(path, old_prefix, new_prefix));
  }
  return remapped;
}

function compact_renames(renames: PrefixRename[]): PrefixRename[] {
  const compacted: PrefixRename[] = [];
  for (const rename of renames) {
    if (rename.old_prefix === rename.new_prefix) {
      continue;
    }
    const previous = compacted.findIndex(
      (entry) => entry.new_prefix === rename.old_prefix,
    );
    if (previous >= 0) {
      compacted[previous] = {
        old_prefix: compacted[previous]?.old_prefix ?? rename.old_prefix,
        new_prefix: rename.new_prefix,
      };
      const composed = compacted[previous];
      if (composed && composed.old_prefix === composed.new_prefix) {
        compacted.splice(previous, 1);
      }
      continue;
    }
    compacted.push(rename);
  }
  return compacted;
}

function compact_path_renames(renames: PathRename[]): PathRename[] {
  const compacted: PathRename[] = [];
  for (const rename of renames) {
    if (rename.old_path === rename.new_path) {
      continue;
    }
    const previous = compacted.findIndex(
      (entry) => entry.new_path === rename.old_path,
    );
    if (previous >= 0) {
      compacted[previous] = {
        old_path: compacted[previous]?.old_path ?? rename.old_path,
        new_path: rename.new_path,
      };
      const composed = compacted[previous];
      if (composed && composed.old_path === composed.new_path) {
        compacted.splice(previous, 1);
      }
      continue;
    }
    compacted.push(rename);
  }
  return compacted;
}

function remap_exact_path(
  path: string,
  old_path: string,
  new_path: string,
): string {
  return path === old_path ? new_path : path;
}

function remap_exact_set(
  paths: Set<string>,
  old_path: string,
  new_path: string,
): Set<string> {
  const remapped = new Set<string>();
  for (const path of paths) {
    remapped.add(remap_exact_path(path, old_path, new_path));
  }
  return remapped;
}

function drop_paths_under_prefix(paths: Set<string>, prefix: string): void {
  for (const path of paths) {
    if (path.startsWith(prefix)) {
      paths.delete(path);
    }
  }
}

export function reduce_index_changes(
  changes: IndexChange[],
): ReducedIndexWorkset {
  const workset = create_empty_workset();

  for (const change of changes) {
    if (change.kind === "force_rebuild") {
      workset.upsert_paths.clear();
      workset.remove_paths.clear();
      workset.remove_prefixes.clear();
      workset.rename_paths = [];
      workset.rename_prefixes = [];
      workset.force_scan = false;
      workset.force_rebuild = true;
      continue;
    }

    if (workset.force_rebuild) {
      continue;
    }

    if (change.kind === "force_scan") {
      workset.force_scan = true;
      continue;
    }

    if (change.kind === "upsert_path") {
      const path = String(change.path);
      workset.remove_paths.delete(path);
      workset.upsert_paths.add(path);
      continue;
    }

    if (change.kind === "remove_path") {
      const path = String(change.path);
      workset.upsert_paths.delete(path);
      workset.remove_paths.add(path);
      continue;
    }

    if (change.kind === "remove_prefix") {
      workset.remove_prefixes.add(change.prefix);
      drop_paths_under_prefix(workset.upsert_paths, change.prefix);
      drop_paths_under_prefix(workset.remove_paths, change.prefix);
      continue;
    }

    if (change.kind === "rename_path") {
      workset.upsert_paths = remap_exact_set(
        workset.upsert_paths,
        change.old_path,
        change.new_path,
      );
      workset.remove_paths = remap_exact_set(
        workset.remove_paths,
        change.old_path,
        change.new_path,
      );
      workset.rename_paths = compact_path_renames([
        ...workset.rename_paths,
        {
          old_path: change.old_path,
          new_path: change.new_path,
        },
      ]);
      continue;
    }

    workset.upsert_paths = remap_set(
      workset.upsert_paths,
      change.old_prefix,
      change.new_prefix,
    );
    workset.remove_paths = remap_set(
      workset.remove_paths,
      change.old_prefix,
      change.new_prefix,
    );
    workset.remove_prefixes = remap_set(
      workset.remove_prefixes,
      change.old_prefix,
      change.new_prefix,
    );
    workset.rename_prefixes = compact_renames([
      ...workset.rename_prefixes,
      {
        old_prefix: change.old_prefix,
        new_prefix: change.new_prefix,
      },
    ]);
  }

  return workset;
}

export function count_index_workset_items(
  workset: ReducedIndexWorkset,
): number {
  if (workset.force_rebuild) {
    return 1;
  }
  return (
    workset.rename_paths.length +
    workset.rename_prefixes.length +
    workset.remove_prefixes.size +
    workset.remove_paths.size +
    workset.upsert_paths.size +
    (workset.force_scan ? 1 : 0)
  );
}
