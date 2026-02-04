<script lang="ts">
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_app_flows } from '$lib/flows/create_app_flows'
  import { create_editor_manager } from '$lib/adapters/editor/editor_manager'
  import { create_app_shell_actions } from '$lib/controllers/app_shell_actions'
  import AppShell from '$lib/components/app_shell.svelte'
  import type { AssetPath } from '$lib/types/ids'

  const ports = create_test_ports()
  const editor_manager = create_editor_manager(ports.editor)
  const app = create_app_flows(ports, {
    on_save_complete: () => { editor_manager.mark_clean(); }
  })
  const actions = create_app_shell_actions({
    config: { reset_state_on_mount: true },
    app
  })

  const resolve_asset_url = (asset_path: AssetPath) => {
    const vault_id = app.stores.vault.get_snapshot().vault?.id
    if (!vault_id) {
      return Promise.reject(new Error('No active vault'))
    }
    return ports.assets.resolve_asset_url(vault_id, asset_path)
  }
</script>

<AppShell {app} {actions} {editor_manager} {resolve_asset_url} hide_choose_vault_button={true} />
