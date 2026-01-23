<script lang="ts">
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import HomeShell from '$lib/components/home_shell.svelte'
  import { as_vault_path } from '$lib/types/ids'

  const ports = create_test_ports()
  const bootstrap_default_vault_path = as_vault_path('test-vault')
</script>

<HomeShell {ports} {bootstrap_default_vault_path} reset_state_on_mount={true} />
