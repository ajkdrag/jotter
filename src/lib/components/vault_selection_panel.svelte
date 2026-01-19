<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
  import type { Vault } from '$lib/types/vault'

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

<div class="vault-panel">
  <div class="vault-panel__header">
    <h2 class="vault-panel__title">Select Vault</h2>
  </div>

  <div class="vault-panel__actions">
    <button
      type="button"
      onclick={handle_choose_vault}
      disabled={loading}
      class="vault-panel__button vault-panel__button--primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="vault-panel__icon"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      Choose Vault Directory
    </button>
  </div>

  {#if app_state.recent_vaults.length > 0}
    <div class="vault-panel__section">
      <h3 class="vault-panel__section-title">Recent Vaults</h3>
      <div class="vault-panel__list">
        {#each app_state.recent_vaults as vault (vault.id)}
          <button
            type="button"
            onclick={() => handle_select_vault(vault)}
            disabled={loading || app_state.vault?.id === vault.id}
            class="vault-panel__item"
            class:vault-panel__item--active={app_state.vault?.id === vault.id}
          >
            <div class="vault-panel__item-content">
              <div class="vault-panel__item-name">{vault.name}</div>
              <div class="vault-panel__item-path">{format_path(vault.path)}</div>
            </div>
            {#if app_state.vault?.id === vault.id}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="vault-panel__check-icon"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="vault-panel__empty">
      <p class="vault-panel__empty-text">No recent vaults</p>
      <p class="vault-panel__empty-hint">Choose a vault directory to get started</p>
    </div>
  {/if}
</div>

<style>
  .vault-panel {
    max-width: 65ch;
    margin: 0 auto;
    padding: var(--spacing-8);
    background-color: var(--background-base);
  }

  .vault-panel__header {
    margin-bottom: var(--spacing-8);
  }

  .vault-panel__title {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-semibold);
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--foreground-primary);
    margin: 0;
  }

  .vault-panel__actions {
    margin-bottom: var(--spacing-8);
  }

  .vault-panel__button {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    height: 36px;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    transition: background-color 150ms ease-out;
    cursor: pointer;
    border: none;
    outline: none;
  }

  .vault-panel__button:focus-visible {
    outline: 2px solid var(--control-border-focus);
    outline-offset: 2px;
  }

  .vault-panel__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .vault-panel__button--primary {
    background-color: var(--accent);
    color: white;
  }

  .vault-panel__button--primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .vault-panel__icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .vault-panel__section {
    margin-top: var(--spacing-8);
  }

  .vault-panel__section-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    line-height: 1.4;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--foreground-secondary);
    margin: 0 0 var(--spacing-4) 0;
  }

  .vault-panel__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .vault-panel__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: var(--spacing-4);
    border-radius: var(--radius-md);
    background-color: var(--background-surface-1);
    border: 0.5px solid var(--border-default);
    cursor: pointer;
    transition: background-color 150ms ease-out, border-color 150ms ease-out;
    text-align: left;
    outline: none;
  }

  .vault-panel__item:hover:not(:disabled) {
    background-color: var(--background-surface-2);
  }

  .vault-panel__item:focus-visible {
    outline: 2px solid var(--control-border-focus);
    outline-offset: 2px;
  }

  .vault-panel__item:disabled {
    cursor: default;
  }

  .vault-panel__item--active {
    background-color: var(--background-surface-2);
    border-left: 2px solid var(--accent);
    padding-left: calc(var(--spacing-4) - 2px);
  }

  .vault-panel__item-content {
    flex: 1;
    min-width: 0;
  }

  .vault-panel__item-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-normal);
    color: var(--foreground-primary);
    margin-bottom: var(--spacing-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vault-panel__item-path {
    font-size: var(--font-size-sm);
    color: var(--foreground-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vault-panel__check-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--accent);
    margin-left: var(--spacing-4);
  }

  .vault-panel__empty {
    margin-top: var(--spacing-8);
    padding: var(--spacing-8);
    text-align: center;
  }

  .vault-panel__empty-text {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--foreground-primary);
    margin: 0 0 var(--spacing-2) 0;
  }

  .vault-panel__empty-hint {
    font-size: var(--font-size-sm);
    color: var(--foreground-secondary);
    margin: 0;
  }
</style>