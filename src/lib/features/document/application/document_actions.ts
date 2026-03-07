import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { DocumentStore } from "$lib/features/document/state/document_store.svelte";
import type { DocumentPort } from "$lib/features/document/ports";
import { detect_file_type } from "$lib/features/document/domain/document_types";

export function register_document_actions(
  input: ActionRegistrationInput & {
    document_store: DocumentStore;
    document_port: DocumentPort;
  },
) {
  const { registry, stores, document_store, document_port } = input;

  registry.register({
    id: ACTION_IDS.document_open,
    label: "Open Document",
    execute: async (...args: unknown[]) => {
      const file_path = args[0] as string;
      const vault_id = stores.vault.vault?.id;
      if (!vault_id) return;

      const last_slash = file_path.lastIndexOf("/");
      const filename =
        last_slash >= 0 ? file_path.slice(last_slash + 1) : file_path;
      const file_type = detect_file_type(filename);
      if (!file_type) return;

      const tab = stores.tab.open_document_tab(file_path, filename, file_type);

      const existing = document_store.get_viewer_state(tab.id);
      if (existing) return;

      const needs_content =
        file_type === "code" || file_type === "csv" || file_type === "text";

      let content: string | null = null;
      let asset_url: string | null = null;

      if (needs_content) {
        content = await document_port.read_file(vault_id, file_path);
      } else {
        asset_url = document_port.resolve_asset_url(vault_id, file_path);
      }

      document_store.set_viewer_state(tab.id, {
        tab_id: tab.id,
        file_path,
        file_type,
        zoom: 1,
        scroll_top: 0,
        pdf_page: 1,
        content,
        asset_url,
      });
    },
  });

  registry.register({
    id: ACTION_IDS.document_close,
    label: "Close Document",
    execute: (...args: unknown[]) => {
      const tab_id = args[0] as string;
      document_store.remove_viewer_state(tab_id);
    },
  });
}
