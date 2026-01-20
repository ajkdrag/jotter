<script lang="ts">
  import "../app.css";
  import VaultDialog from "$lib/components/vault_dialog.svelte";
  let { children } = $props();
</script>

<main>
  {@render children()}
</main>

<VaultDialog />
