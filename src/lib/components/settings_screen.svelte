<script lang="ts">
  import { app_state } from '$lib/adapters/state/app_state.svelte'
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
  <h1 class="text-xl font-semibold tracking-tight">Settings</h1>
  <div class="mt-6 rounded-xl border border-border bg-panel p-4">
    <div class="text-sm font-semibold">Vault</div>
    <div class="mt-1 text-sm text-muted">{app_state.vault?.path ?? 'None selected'}</div>
  </div>
</div>
