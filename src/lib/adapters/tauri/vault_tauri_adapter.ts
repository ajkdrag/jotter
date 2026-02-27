import type { VaultPort } from "$lib/ports/vault_port";
import { choose_vault_directory } from "$lib/adapters/tauri/dialog_adapter";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";
import type { VaultId, VaultPath } from "$lib/types/ids";
import type { Vault } from "$lib/types/vault";

export function create_vault_tauri_adapter(): VaultPort {
  const invoke_vault = <Result>(
    command: string,
    payload?: Record<string, unknown>,
  ) => tauri_invoke<Result>(command, payload);
  const invoke_vault_args = <Result>(
    command: string,
    args: Record<string, unknown>,
  ) => tauri_invoke<Result>(command, { args });

  return {
    choose_vault: choose_vault_directory,
    async open_vault(vault_path: VaultPath) {
      return await invoke_vault_args<Vault>("open_vault", { vault_path });
    },
    async open_vault_by_id(vault_id: VaultId) {
      return await invoke_vault<Vault>("open_vault_by_id", {
        vaultId: vault_id,
      });
    },
    async list_vaults() {
      return await invoke_vault<Vault[]>("list_vaults");
    },
    async remove_vault(vault_id: VaultId) {
      await invoke_vault_args<undefined>("remove_vault_from_registry", {
        vault_id,
      });
    },
    async remember_last_vault(vault_id: VaultId) {
      await invoke_vault_args<undefined>("remember_last_vault", {
        vault_id,
      });
    },
    async get_last_vault_id() {
      return await invoke_vault<VaultId | null>("get_last_vault_id");
    },
  };
}
