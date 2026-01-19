<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
  import type { Vault } from '$lib/types/vault'
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Plus, Check } from '@lucide/svelte'

  const vault_workflow = create_change_vault_workflow()
  let loading = $state(false)

  onMount(async () => {
    await vault_workflow.load_recent()
  })

  async function handle_choose_vault() {
    loading = true
    try {
      await vault_workflow.choose_and_change()
    } finally {
      loading = false
    }
  }

  async function handle_select_vault(vault: Vault) {
    loading = true
    try {
      await vault_workflow.open_recent(vault.id)
    } finally {
      loading = false
    }
  }

  function format_path(path: string): string {
    const parts = path.split(/[/\\]/)
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`
    }
    return path
  }
</script>

<div class="mx-auto max-w-[65ch] p-8">
  <Card.Root>
    <Card.Header>
      <Card.Title>Select Vault</Card.Title>
      <Card.Description>Choose a vault directory or select from recent vaults</Card.Description>
    </Card.Header>

    <Card.Content class="space-y-6">
      <Button
        onclick={handle_choose_vault}
        disabled={loading}
        class="w-full"
      >
        <Plus />
        Choose Vault Directory
      </Button>

      {#if app_state.recent_vaults.length > 0}
        <div class="mt-4 space-y-3">
          <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Vaults
          </h3>
          <div class="flex flex-col gap-2">
            {#each app_state.recent_vaults as vault (vault.id)}
              <button
                type="button"
                onclick={() => handle_select_vault(vault)}
                disabled={loading || app_state.vault?.id === vault.id}
                class="flex min-h-14 items-center justify-between rounded-lg border bg-card px-4 py-3 text-left outline-none transition-all hover:bg-accent/10 hover:border-accent/30 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60 data-[active=true]:bg-accent/15 data-[active=true]:border-l-[3px] data-[active=true]:border-l-primary data-[active=true]:pl-[calc(1rem-2px)]"
                data-active={app_state.vault?.id === vault.id}
              >
                <div class="min-w-0 flex-1">
                  <div class="mb-1 truncate text-[0.9375rem] font-medium text-foreground">
                    {vault.name}
                  </div>
                  <div class="truncate text-[0.8125rem] text-muted-foreground">
                    {format_path(vault.path)}
                  </div>
                </div>
                {#if app_state.vault?.id === vault.id}
                  <Check class="ml-4 shrink-0 text-primary" />
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="py-12 px-6 text-center">
          <p class="mb-2 text-[0.9375rem] font-medium text-foreground">No recent vaults</p>
          <p class="text-sm text-muted-foreground">Choose a vault directory to get started</p>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>