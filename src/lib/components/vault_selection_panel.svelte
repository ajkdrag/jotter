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
    on_choose_vault_dir: () => void
    on_select_vault: (vault_id: VaultId) => void
    on_close?: () => void
    is_dialog?: boolean
    hide_choose_vault_button?: boolean
  }

  let {
    recent_vaults,
    current_vault_id,
    is_loading = false,
    error = null,
    on_choose_vault_dir,
    on_select_vault,
    on_close,
    is_dialog = false,
    hide_choose_vault_button = false
  }: Props = $props()

  function handle_choose_vault(event?: Event) {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    on_choose_vault_dir()
  }

  function handle_select_vault(vault: Vault, event?: Event) {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    on_select_vault(vault.id)
  }

  function format_path(path: string): string {
    const parts = path.split(/[/\\\\]/)
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`
    }
    return path
  }
</script>

{#if is_dialog}
  <div class="flex flex-col gap-6">
    <div class="relative">
      {#if on_close}
        <button
          type="button"
          onclick={on_close}
          disabled={is_loading}
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
  {#if !hide_choose_vault_button}
    <Button
      onclick={(e) => handle_choose_vault(e)}
      disabled={is_loading}
      class="w-full"
    >
      <Plus />
      Choose Vault Directory
    </Button>
  {/if}

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
            class="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-left transition-all hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60 {current_vault_id === vault.id ? 'bg-accent/20 border-primary/30' : ''}"
            data-active={current_vault_id === vault.id}
          >
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{vault.name}</div>
              <div class="truncate text-sm text-muted-foreground">{format_path(vault.path)}</div>
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
