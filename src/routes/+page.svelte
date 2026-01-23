<script lang="ts">
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import HomeShell from "$lib/components/home_shell.svelte";

  const ports = create_prod_ports();
</script>

<HomeShell {ports} />

