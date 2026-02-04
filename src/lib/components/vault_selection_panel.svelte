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

  function handle_choose_vault(event?: MouseEvent) {
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
        <!-- eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -->
        {@render content()}
      </Card.Content>
    </Card.Root>
  </div>
{/if}

{#snippet content()}
  {#if !hide_choose_vault_button}
    <Button
      onclick={(e: MouseEvent) => { handle_choose_vault(e); }}
      disabled={is_loading}
      class="VaultPanel__action-btn"
    >
      <Plus />
      Choose Vault Directory
    </Button>
  {/if}

  {#if error}
    <div class="VaultPanel__error">
      {error}
    </div>
  {/if}

  {#if recent_vaults.length > 0}
    <div class="VaultPanel__recent">
      <h3 class="VaultPanel__section-title">
        Recent Vaults
      </h3>
      <div class="VaultPanel__list">
        {#each recent_vaults as vault (vault.id)}
          <button
            type="button"
            onclick={(e) => { handle_select_vault(vault, e); }}
            disabled={is_loading || current_vault_id === vault.id}
            class="VaultPanel__vault-item"
            class:VaultPanel__vault-item--active={current_vault_id === vault.id}
            data-active={current_vault_id === vault.id}
          >
            <div class="VaultPanel__vault-info">
              <div class="VaultPanel__vault-name">{vault.name}</div>
              <div class="VaultPanel__vault-path">{format_path(vault.path)}</div>
            </div>
            {#if current_vault_id === vault.id}
              <Check class="VaultPanel__check-icon" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="VaultPanel__empty">
      <p class="VaultPanel__empty-title">No recent vaults</p>
      <p class="VaultPanel__empty-desc">Choose a vault directory to get started</p>
    </div>
  {/if}
{/snippet}

<style>
  :global(.VaultPanel__action-btn) {
    width: 100%;
  }

  .VaultPanel__error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background-color: var(--card);
    font-size: var(--text-base);
    color: var(--destructive);
  }

  .VaultPanel__recent {
    margin-top: var(--space-4);
  }

  .VaultPanel__section-title {
    margin-bottom: var(--space-3);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .VaultPanel__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .VaultPanel__vault-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2-5) var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background-color: var(--card);
    text-align: left;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .VaultPanel__vault-item:hover:not(:disabled) {
    background-color: color-mix(in oklch, var(--muted) 50%, transparent);
  }

  .VaultPanel__vault-item:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .VaultPanel__vault-item:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .VaultPanel__vault-item--active {
    background-color: var(--interactive-bg);
    border-color: color-mix(in oklch, var(--interactive) 30%, transparent);
  }

  .VaultPanel__vault-item--active:hover:not(:disabled) {
    background-color: var(--interactive-bg-hover);
  }

  .VaultPanel__vault-info {
    flex: 1;
    min-width: 0;
  }

  .VaultPanel__vault-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .VaultPanel__vault-path {
    font-size: var(--text-base);
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.VaultPanel__check-icon) {
    margin-left: var(--space-4);
    flex-shrink: 0;
    width: var(--size-icon-md);
    height: var(--size-icon-md);
    color: var(--interactive);
  }

  .VaultPanel__empty {
    padding: var(--space-12) var(--space-6);
    text-align: center;
  }

  .VaultPanel__empty-title {
    margin-bottom: var(--space-2);
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--foreground);
  }

  .VaultPanel__empty-desc {
    font-size: var(--text-base);
    color: var(--muted-foreground);
  }
</style>
