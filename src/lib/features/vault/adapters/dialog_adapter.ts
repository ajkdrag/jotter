import { open } from "@tauri-apps/plugin-dialog";
import { as_vault_path, type VaultPath } from "$lib/shared/types/ids";

export async function choose_vault_directory(): Promise<VaultPath | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (!selected) return null;
  if (Array.isArray(selected)) return null;
  return as_vault_path(selected);
}
