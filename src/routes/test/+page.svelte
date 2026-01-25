<script lang="ts">
  import { create_test_ports } from '$lib/adapters/test/test_ports'
  import AppShell from '$lib/components/app_shell.svelte'

  const ports = create_test_ports()
</script>

<AppShell {ports} reset_state_on_mount={true} hide_choose_vault_button={true} />
