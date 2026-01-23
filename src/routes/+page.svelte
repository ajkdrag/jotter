<script lang="ts">
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import AppShell from "$lib/components/app_shell.svelte";

  const ports = create_prod_ports();
</script>

<AppShell {ports} />
