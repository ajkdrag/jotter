import type { VaultId, VaultPath } from "$lib/types/ids";

export type Vault = {
  id: VaultId;
  path: VaultPath;
  name: string;
  created_at: number;
};
