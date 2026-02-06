import type { VaultPort } from '$lib/ports/vault_port'
import type { VaultPath } from '$lib/types/ids'

export async function choose_vault_use_case(
  ports: { vault: VaultPort }
): Promise<VaultPath | null> {
  return await ports.vault.choose_vault()
}
