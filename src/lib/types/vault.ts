import type { VaultId, VaultPath } from "$lib/types/ids";

export type Vault = {
  id: VaultId;
  path: VaultPath;
  name: string;
  created_at: number;
  last_opened_at?: number | null;
  note_count?: number | null;
};
