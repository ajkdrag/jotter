<script lang="ts">
  import { onDestroy } from 'svelte'
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import { create_app_context } from '$lib/di/create_app_context'
  import { provide_app_context } from '$lib/context/app_context.svelte'
  import AppShell from '$lib/components/app_shell.svelte'

  const ports = create_test_ports()

  const app = create_app_context({
    ports,
    now_ms: () => Date.now(),
    default_mount_config: {
      reset_app_state: true,
      bootstrap_default_vault_path: null
    }
  })

  provide_app_context(app)

  onDestroy(() => {
    app.destroy()
  })
</script>

<AppShell hide_choose_vault_button={true} />
