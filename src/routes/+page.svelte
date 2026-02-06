<script lang="ts">
  import { onDestroy } from "svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { create_app_flows } from "$lib/flows/create_app_flows";
  import { create_app_shell_actions } from "$lib/controllers/app_shell_actions";
  import { create_app_stores } from "$lib/stores/create_app_stores";
  import { create_event_bus } from "$lib/events/event_bus";
  import { create_editor_runtime } from "$lib/shell/editor_runtime";
  import { attach_shell_reactions } from "$lib/shell/app_shell_reactions";
  import type { AssetPath } from "$lib/types/ids";
  import AppShell from "$lib/components/app_shell.svelte";

  const ports = create_prod_ports();
  const now_ms = () => Date.now();
  const stores = create_app_stores({ now_ms });
  const event_bus = create_event_bus(stores);

  const resolve_asset_url = (asset_path: AssetPath) => {
    const vault_id = stores.vault.get_snapshot().vault?.id;
    if (!vault_id) {
      return Promise.reject(new Error("No active vault"));
    }
    return ports.assets.resolve_asset_url(vault_id, asset_path);
  };

  const editor_runtime = create_editor_runtime({
    editor: ports.editor,
    emit_event: event_bus.dispatch,
    resolve_asset_url
  });

  const app = create_app_flows({
    ports,
    stores,
    dispatch: event_bus.dispatch,
    dispatch_many: event_bus.dispatch_many,
    now_ms,
    editor_runtime
  });

  const actions = create_app_shell_actions({
    config: { reset_state_on_mount: false },
    app,
  });

  const detach_shell = attach_shell_reactions({
    event_bus,
    editor_flow: app.flows.editor,
    open_note_flow: app.flows.open_note,
    filetree_flow: app.flows.filetree,
    readers: {
      get_link_syntax: () => stores.ui.get_snapshot().editor_settings.link_syntax,
      get_vault: () => stores.vault.get_snapshot().vault,
      get_open_note: () => stores.editor.get_snapshot().open_note
    }
  });

  onDestroy(() => {
    detach_shell();
  });
</script>

<AppShell {app} {actions} />
