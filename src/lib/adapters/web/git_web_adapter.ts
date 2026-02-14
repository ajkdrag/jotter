import git from "isomorphic-git";
import type { GitPort } from "$lib/ports/git_port";
import type { VaultPath } from "$lib/types/ids";
import type {
  GitCommit,
  GitDiff,
  GitFileStatus,
  GitStatus,
} from "$lib/types/git";
import { create_fsa_fs, type FsAdapter } from "./fsa_fs_adapter";
import { compute_line_diff } from "./git_diff_utils";
import { list_vaults, type VaultRecord } from "./storage";

const DIR = "/";

async function find_vault_record(vault_path: VaultPath): Promise<VaultRecord> {
  const vaults = await list_vaults();
  const record = vaults.find((v) => v.path === vault_path);
  if (!record) {
    throw new Error(`Vault not found: ${vault_path}`);
  }
  return record;
}

async function get_fs_for_vault(vault_path: VaultPath): Promise<FsAdapter> {
  const record = await find_vault_record(vault_path);
  return create_fsa_fs(record.handle);
}

function decode_blob(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

type StatusRow = [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3];

function map_file_status(row: StatusRow): GitFileStatus | null {
  const [filepath, head, workdir, stage] = row;

  if (head === 0 && workdir === 2) {
    return { path: filepath, status: "untracked" };
  }
  if (head === 0 && stage === 2) {
    return { path: filepath, status: "added" };
  }
  if (head === 1 && workdir === 0) {
    return { path: filepath, status: "deleted" };
  }
  if (head === 1 && workdir === 2) {
    if (stage === 1) return null;
    return { path: filepath, status: "modified" };
  }

  if (head === 1 && stage === 0) {
    return { path: filepath, status: "deleted" };
  }
  if (head === 1 && stage === 2) {
    return { path: filepath, status: "added" };
  }
  if (head === 1 && stage === 3) {
    return { path: filepath, status: "modified" };
  }

  return null;
}

export function create_git_web_adapter(): GitPort {
  return {
    async has_repo(vault_path: VaultPath): Promise<boolean> {
      try {
        const record = await find_vault_record(vault_path);
        await record.handle.getDirectoryHandle(".git", { create: false });
        return true;
      } catch {
        return false;
      }
    },

    async init_repo(vault_path: VaultPath): Promise<void> {
      const fs = await get_fs_for_vault(vault_path);
      await git.init({ fs, dir: DIR });
    },

    async status(vault_path: VaultPath): Promise<GitStatus> {
      const fs = await get_fs_for_vault(vault_path);

      let branch = "main";
      try {
        branch = (await git.currentBranch({ fs, dir: DIR })) ?? "main";
      } catch {
        // empty
      }

      const matrix = (await git.statusMatrix({ fs, dir: DIR })) as StatusRow[];
      const files: GitFileStatus[] = [];
      for (const row of matrix) {
        const mapped = map_file_status(row);
        if (mapped) files.push(mapped);
      }

      return {
        branch,
        is_dirty: files.length > 0,
        ahead: 0,
        behind: 0,
        files,
      };
    },

    async stage_and_commit(
      vault_path: VaultPath,
      message: string,
      files: string[] | null,
    ): Promise<string> {
      const fs = await get_fs_for_vault(vault_path);

      if (files) {
        for (const filepath of files) {
          try {
            await fs.promises.stat(`/${filepath}`);
            await git.add({ fs, dir: DIR, filepath });
          } catch {
            await git.remove({ fs, dir: DIR, filepath });
          }
        }
      } else {
        const matrix = (await git.statusMatrix({
          fs,
          dir: DIR,
        })) as StatusRow[];
        for (const row of matrix) {
          const [filepath, head, workdir] = row;
          if (head !== workdir) {
            if (workdir === 0) {
              await git.remove({ fs, dir: DIR, filepath });
            } else {
              await git.add({ fs, dir: DIR, filepath });
            }
          }
        }
      }

      const sha = await git.commit({
        fs,
        dir: DIR,
        message,
        author: { name: "Jotter", email: "jotter@local" },
      });

      return sha;
    },

    async log(
      vault_path: VaultPath,
      file_path: string | null,
      limit: number,
    ): Promise<GitCommit[]> {
      const fs = await get_fs_for_vault(vault_path);

      const log_opts: Parameters<typeof git.log>[0] = {
        fs,
        dir: DIR,
        depth: file_path ? limit * 10 : limit,
      };

      const commits = await git.log(log_opts);

      let filtered = commits;
      if (file_path) {
        filtered = [];
        for (const entry of commits) {
          if (filtered.length >= limit) break;
          const has_file = await commit_touches_file(
            fs,
            entry.oid,
            entry.commit.parent[0] ?? null,
            file_path,
          );
          if (has_file) filtered.push(entry);
        }
      } else {
        filtered = commits.slice(0, limit);
      }

      return filtered.map((entry) => ({
        hash: entry.oid,
        short_hash: entry.oid.slice(0, 7),
        author: entry.commit.author.name,
        timestamp_ms: entry.commit.author.timestamp * 1000,
        message: entry.commit.message.trim(),
      }));
    },

    async diff(
      vault_path: VaultPath,
      commit_a: string,
      commit_b: string,
      file_path: string | null,
    ): Promise<GitDiff> {
      const fs = await get_fs_for_vault(vault_path);
      const target = file_path ?? "";

      const old_text = await read_blob_text(fs, commit_a, target);
      const new_text = await read_blob_text(fs, commit_b, target);

      return compute_line_diff(old_text, new_text);
    },

    async show_file_at_commit(
      vault_path: VaultPath,
      file_path: string,
      commit_hash: string,
    ): Promise<string> {
      const fs = await get_fs_for_vault(vault_path);
      return await read_blob_text(fs, commit_hash, file_path);
    },

    async restore_file(
      vault_path: VaultPath,
      file_path: string,
      commit_hash: string,
    ): Promise<string> {
      const fs = await get_fs_for_vault(vault_path);
      const content = await read_blob_text(fs, commit_hash, file_path);
      await fs.promises.writeFile(`/${file_path}`, content);
      return content;
    },
  };
}

async function read_blob_text(
  fs: FsAdapter,
  commit_hash: string,
  filepath: string,
): Promise<string> {
  if (!filepath) return "";

  try {
    const { blob } = await git.readBlob({
      fs,
      dir: DIR,
      oid: commit_hash,
      filepath,
    });
    return decode_blob(blob);
  } catch {
    return "";
  }
}

async function commit_touches_file(
  fs: FsAdapter,
  oid: string,
  parent_oid: string | null,
  filepath: string,
): Promise<boolean> {
  try {
    const current = await git.readBlob({ fs, dir: DIR, oid, filepath });

    if (!parent_oid) return true;

    try {
      const parent = await git.readBlob({
        fs,
        dir: DIR,
        oid: parent_oid,
        filepath,
      });
      return current.oid !== parent.oid;
    } catch {
      return true;
    }
  } catch {
    if (!parent_oid) return false;
    try {
      await git.readBlob({ fs, dir: DIR, oid: parent_oid, filepath });
      return true;
    } catch {
      return false;
    }
  }
}
