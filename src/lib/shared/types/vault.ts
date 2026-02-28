import type { VaultId, VaultPath } from "$lib/shared/types/ids";

export type Vault = {
  id: VaultId;
  path: VaultPath;
  name: string;
  created_at: number;
  last_opened_at?: number | null;
  note_count?: number | null;
  is_available?: boolean;
};
