<script lang="ts">
  import { onDestroy } from "svelte";
  import { create_prod_ports } from "$lib/app/create_prod_ports";
  import { create_app_context } from "$lib/app/di/create_app_context";
  import { provide_app_context } from "$lib/app/context/app_context.svelte";
  import { as_vault_path } from "$lib/shared/types/ids";
  import { AppShell, ViewerShell, BrowseShell } from "$lib/app";
  import { parse_window_init } from "$lib/features/window";

  const url_params = new URLSearchParams(window.location.search);
  const vault_path_param = url_params.get("vault_path");
  const file_path_param = url_params.get("file_path");

  const window_init = parse_window_init(url_params);

  const ports = create_prod_ports();

  const app = create_app_context({
    ports,
    now_ms: () => Date.now(),
    default_mount_config: {
      reset_app_state: false,
      bootstrap_default_vault_path: vault_path_param
        ? as_vault_path(vault_path_param)
        : null,
      open_file_after_mount: file_path_param,
    },
  });

  provide_app_context(app);

  onDestroy(() => {
    app.destroy();
  });
</script>

{#if window_init.kind === "viewer"}
  <ViewerShell />
{:else if window_init.kind === "browse"}
  <BrowseShell />
{:else}
  <AppShell />
{/if}
