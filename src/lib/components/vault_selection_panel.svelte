<script lang="ts">
  import type { Vault } from '$lib/types/vault'
  import type { VaultId } from '$lib/types/ids'
  import * as Card from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Plus, Check, X } from '@lucide/svelte'

  interface Props {
    recent_vaults: Vault[]
    current_vault_id: VaultId | null
    is_loading?: boolean
    error?: string | null
    onChooseVaultDir: () => void
    onSelectVault: (vault_id: VaultId) => void
    onClose?: () => void
    isDialog?: boolean
  }

  let {
    recent_vaults,
    current_vault_id,
    is_loading = false,
    error = null,
    onChooseVaultDir,
    onSelectVault,
    onClose,
    isDialog = false
  }: Props = $props()

  function handle_choose_vault(event?: Event) {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    onChooseVaultDir()
    if (onClose) onClose()
  }

  function handle_select_vault(vault: Vault, event?: Event) {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    onSelectVault(vault.id)
    if (onClose) onClose()
  }

  function format_path(path: string): string {
    const parts = path.split(/[/\\]/)
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`
    }
    return path
  }
</script>

{#if isDialog}
  <div class="flex flex-col gap-6">
    <div class="relative">
      {#if onClose}
        <button
          type="button"
          onclick={onClose}
          class="ring-offset-background focus:ring-ring absolute end-0 top-0 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <X class="h-4 w-4" />
          <span class="sr-only">Close</span>
        </button>
      {/if}
      <div class="space-y-1.5 pr-8">
        <h2 class="text-lg font-semibold leading-none tracking-tight">Select Vault</h2>
        <p class="text-sm text-muted-foreground">Choose a vault directory or select from recent vaults</p>
      </div>
    </div>
    <div class="space-y-6">
      {@render content()}
    </div>
  </div>
{:else}
  <div class="p-0">
    <Card.Root>
      <Card.Header>
        <Card.Title>Select Vault</Card.Title>
        <Card.Description>Choose a vault directory or select from recent vaults</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        {@render content()}
      </Card.Content>
    </Card.Root>
  </div>
{/if}

{#snippet content()}
  <Button
    onclick={(e) => handle_choose_vault(e)}
    disabled={is_loading}
    class="w-full"
  >
    <Plus />
    Choose Vault Directory
  </Button>

  {#if error}
    <div class="rounded-lg border border-border bg-card px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  {/if}

  {#if recent_vaults.length > 0}
    <div class="mt-4 space-y-3">
      <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent Vaults
      </h3>
      <div class="flex flex-col gap-2">
        {#each recent_vaults as vault (vault.id)}
          <button
            type="button"
            onclick={(e) => handle_select_vault(vault, e)}
            disabled={is_loading || current_vault_id === vault.id}
            class="flex min-h-14 items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-left outline-none transition-all hover:bg-muted/70 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60 data-[active=true]:bg-accent/20 data-[active=true]:border-primary/30"
            data-active={current_vault_id === vault.id}
          >
            <div class="min-w-0 flex-1">
              <div class="mb-1 truncate text-[0.9375rem] font-medium text-foreground">
                {vault.name}
              </div>
              <div class="truncate text-[0.8125rem] text-muted-foreground">
                {format_path(vault.path)}
              </div>
            </div>
            {#if current_vault_id === vault.id}
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
{/snippet}
