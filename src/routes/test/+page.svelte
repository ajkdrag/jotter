<script lang="ts">
  import { onDestroy } from 'svelte'
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_app_flows } from '$lib/flows/create_app_flows'
  import { create_app_shell_actions } from '$lib/controllers/app_shell_actions'
  import { create_app_stores } from '$lib/stores/create_app_stores'
  import { create_event_bus } from '$lib/events/event_bus'
  import { create_editor_runtime } from '$lib/shell/editor_runtime'
  import { attach_shell_reactions } from '$lib/shell/app_shell_reactions'
  import AppShell from '$lib/components/app_shell.svelte'

  const ports = create_test_ports()
  const now_ms = () => Date.now()
  const stores = create_app_stores({ now_ms })
  const event_bus = create_event_bus(stores)
  const editor_runtime = create_editor_runtime({
    editor: ports.editor,
    emit_event: event_bus.dispatch,
    resolve_asset_url: undefined
  })

  const app = create_app_flows({
    ports,
    stores,
    dispatch: event_bus.dispatch,
    dispatch_many: event_bus.dispatch_many,
    now_ms,
    editor_runtime
  })
  const actions = create_app_shell_actions({
    config: { reset_state_on_mount: true },
    app
  })

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
  })

  onDestroy(() => {
    detach_shell()
  })
</script>

<AppShell {app} {actions} hide_choose_vault_button={true} />
