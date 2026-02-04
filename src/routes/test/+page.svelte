<script lang="ts">
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_app_flows } from '$lib/flows/create_app_flows'
  import { create_editor_manager } from '$lib/adapters/editor/editor_manager'
  import { create_app_shell_actions } from '$lib/controllers/app_shell_actions'
  import AppShell from '$lib/components/app_shell.svelte'

  const ports = create_test_ports()
  const editor_manager = create_editor_manager(ports.editor)
  const app = create_app_flows(ports, {
    on_save_complete: () => { editor_manager.mark_clean(); }
  })
  const actions = create_app_shell_actions({
    config: { reset_state_on_mount: true },
    app
  })
</script>

<AppShell {app} {actions} {editor_manager} hide_choose_vault_button={true} />
