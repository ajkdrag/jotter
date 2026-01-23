<script lang="ts">
  import { create_prod_ports } from '$lib/adapters/create_prod_ports'
  import VaultSelectionScreen from '$lib/components/vault_selection_screen.svelte'

  const ports = create_prod_ports()
</script>

<VaultSelectionScreen {ports} />
