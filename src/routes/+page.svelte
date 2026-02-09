<script lang="ts">
  import { onDestroy } from "svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { create_app_context } from "$lib/di/create_app_context";
  import { provide_app_context } from "$lib/context/app_context.svelte";
  import AppShell from "$lib/components/app_shell.svelte";

  const ports = create_prod_ports();

  const app = create_app_context({
    ports,
    now_ms: () => Date.now(),
    default_mount_config: {
      reset_app_state: false,
      bootstrap_default_vault_path: null,
    },
  });

  provide_app_context(app);

  onDestroy(() => {
    app.destroy();
  });
</script>

<AppShell />
