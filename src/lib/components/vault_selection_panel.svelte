<script lang="ts">
  import type { Vault } from "$lib/types/vault";
  import type { VaultId } from "$lib/types/ids";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { search_vaults } from "$lib/domain/search_vaults";
  import { format_relative_time } from "$lib/utils/relative_time";
  import {
    clamp_vault_selection,
    duplicate_vault_names,
    move_vault_selection,
  } from "$lib/domain/vault_switcher";
  import { Plus, Check, Star, Trash2, X } from "@lucide/svelte";

  interface Props {
    recent_vaults: Vault[];
    pinned_vault_ids: VaultId[];
    current_vault_id: VaultId | null;
    is_loading?: boolean;
    error?: string | null;
    on_choose_vault_dir: () => void;
    on_select_vault: (vault_id: VaultId) => void;
    on_toggle_pin_vault: (vault_id: VaultId) => void;
    on_remove_vault: (vault_id: VaultId) => void;
    on_close?: () => void;
    is_dialog?: boolean;
    hide_choose_vault_button?: boolean;
  }

  let {
    recent_vaults,
    pinned_vault_ids,
    current_vault_id,
    is_loading = false,
    error = null,
    on_choose_vault_dir,
    on_select_vault,
    on_toggle_pin_vault,
    on_remove_vault,
    on_close,
    is_dialog = false,
    hide_choose_vault_button = false,
  }: Props = $props();
  let vault_query = $state("");
  let selected_vault_index = $state(0);
  const filtered_recent_vaults = $derived(
    search_vaults(recent_vaults, vault_query),
  );
  const duplicate_names = $derived(duplicate_vault_names(recent_vaults));

  $effect(() => {
    selected_vault_index = clamp_vault_selection(
      selected_vault_index,
      filtered_recent_vaults.length,
    );
  });

  function handle_choose_vault(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    on_choose_vault_dir();
  }

  function handle_select_vault(vault: Vault, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!is_vault_available(vault)) {
      return;
    }
    on_select_vault(vault.id);
  }

  function handle_toggle_pin(vault_id: VaultId, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    on_toggle_pin_vault(vault_id);
  }

  function handle_remove_vault(vault_id: VaultId, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    on_remove_vault(vault_id);
  }

  function open_selected_vault() {
    if (selected_vault_index < 0) {
      return;
    }
    const selected_vault = filtered_recent_vaults[selected_vault_index];
    if (!selected_vault) {
      return;
    }
    if (
      is_loading ||
      selected_vault.id === current_vault_id ||
      !is_vault_available(selected_vault)
    ) {
      return;
    }
    on_select_vault(selected_vault.id);
  }

  function handle_search_keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selected_vault_index = move_vault_selection(
        selected_vault_index,
        filtered_recent_vaults.length,
        1,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selected_vault_index = move_vault_selection(
        selected_vault_index,
        filtered_recent_vaults.length,
        -1,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      open_selected_vault();
      return;
    }
    if (event.key === "Escape" && on_close) {
      event.preventDefault();
      on_close();
    }
  }

  function format_path(path: string, vault_name: string): string {
    if (duplicate_names.has(vault_name)) {
      return path;
    }
    const parts = path.split(/[/\\\\]/);
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join("/")}`;
    }
    return path;
  }

  function format_last_opened(vault: Vault): string {
    if (!vault.last_opened_at) {
      return "--";
    }
    return format_relative_time(vault.last_opened_at, Date.now());
  }

  function format_note_count(vault: Vault): string {
    if (typeof vault.note_count !== "number") {
      return "-- notes";
    }
    const suffix = vault.note_count === 1 ? "note" : "notes";
    return `${vault.note_count} ${suffix}`;
  }

  function is_vault_available(vault: Vault): boolean {
    return vault.is_available !== false;
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
        <h2 class="text-lg font-semibold leading-none tracking-tight">
          Select Vault
        </h2>
        <p class="text-sm text-muted-foreground">
          Choose a vault directory or select from recent vaults
        </p>
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
        <Card.Description
          >Choose a vault directory or select from recent vaults</Card.Description
        >
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
      onclick={(e: MouseEvent) => {
        handle_choose_vault(e);
      }}
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
      <h3 class="VaultPanel__section-title">Recent Vaults</h3>
      <div class="VaultPanel__search">
        <Input
          type="text"
          value={vault_query}
          oninput={(event: Event & { currentTarget: HTMLInputElement }) => {
            vault_query = event.currentTarget.value;
            selected_vault_index = 0;
          }}
          onkeydown={handle_search_keydown}
          placeholder="Search vaults..."
          aria-label="Search vaults"
        />
      </div>
      <div class="VaultPanel__list">
        {#each filtered_recent_vaults as vault, index (vault.id)}
          <div
            class="VaultPanel__vault-item"
            class:VaultPanel__vault-item--active={current_vault_id === vault.id}
            class:VaultPanel__vault-item--highlighted={index ===
              selected_vault_index}
            class:VaultPanel__vault-item--unavailable={!is_vault_available(
              vault,
            )}
            data-disabled={is_loading ||
              current_vault_id === vault.id ||
              !is_vault_available(vault)}
          >
            <button
              type="button"
              onclick={(e) => {
                handle_select_vault(vault, e);
              }}
              onmouseenter={() => {
                selected_vault_index = index;
              }}
              disabled={is_loading ||
                current_vault_id === vault.id ||
                !is_vault_available(vault)}
              class="VaultPanel__vault-select-btn"
            >
              <div class="VaultPanel__vault-info">
                <div class="VaultPanel__vault-name">{vault.name}</div>
                <div
                  class="VaultPanel__vault-path"
                  class:VaultPanel__vault-path--disambiguated={duplicate_names.has(
                    vault.name,
                  )}
                >
                  {format_path(vault.path, vault.name)}
                </div>
                <div class="VaultPanel__vault-meta">
                  {#if is_vault_available(vault)}
                    <span>Opened {format_last_opened(vault)}</span>
                    <span class="VaultPanel__vault-count">
                      {format_note_count(vault)}
                    </span>
                  {:else}
                    <span class="VaultPanel__vault-unavailable">
                      Unavailable
                    </span>
                  {/if}
                </div>
              </div>
            </button>
            <div class="VaultPanel__vault-actions">
              <button
                type="button"
                class="VaultPanel__pin-btn"
                class:VaultPanel__pin-btn--active={pinned_vault_ids.includes(
                  vault.id,
                )}
                onclick={(event) => {
                  handle_toggle_pin(vault.id, event);
                }}
                disabled={is_loading}
                aria-label={pinned_vault_ids.includes(vault.id)
                  ? "Unpin vault"
                  : "Pin vault"}
              >
                <Star />
              </button>
              <button
                type="button"
                class="VaultPanel__pin-btn"
                onclick={(event) => {
                  handle_remove_vault(vault.id, event);
                }}
                disabled={is_loading || current_vault_id === vault.id}
                aria-label="Remove vault from list"
              >
                <Trash2 />
              </button>
              {#if current_vault_id === vault.id}
                <Check class="VaultPanel__check-icon" />
              {/if}
            </div>
          </div>
        {/each}
      </div>
      {#if filtered_recent_vaults.length === 0}
        <div class="VaultPanel__empty-filter">No vaults match your search</div>
      {/if}
    </div>
  {:else}
    <div class="VaultPanel__empty">
      <p class="VaultPanel__empty-title">No recent vaults</p>
      <p class="VaultPanel__empty-desc">
        Choose a vault directory to get started
      </p>
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

  .VaultPanel__search {
    margin-bottom: var(--space-3);
  }

  .VaultPanel__empty-filter {
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .VaultPanel__vault-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-2-5) var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background-color: var(--card);
    text-align: left;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .VaultPanel__vault-item:not([data-disabled="true"]):hover {
    background-color: color-mix(in oklch, var(--muted) 50%, transparent);
  }

  .VaultPanel__vault-item[data-disabled="true"] {
    cursor: default;
    opacity: 0.6;
  }

  .VaultPanel__vault-item--unavailable {
    border-style: dashed;
  }

  .VaultPanel__vault-item--active {
    background-color: var(--interactive-bg);
    border-color: color-mix(in oklch, var(--interactive) 30%, transparent);
  }

  .VaultPanel__vault-item--highlighted:not(.VaultPanel__vault-item--active) {
    border-color: color-mix(in oklch, var(--interactive) 20%, transparent);
    background-color: color-mix(in oklch, var(--muted) 80%, transparent);
  }

  .VaultPanel__vault-item--active:not([data-disabled="true"]):hover {
    background-color: var(--interactive-bg-hover);
  }

  .VaultPanel__vault-info {
    flex: 1;
    min-width: 0;
  }

  .VaultPanel__vault-select-btn {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .VaultPanel__vault-select-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-md);
  }

  .VaultPanel__vault-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: var(--space-4);
  }

  .VaultPanel__pin-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-touch-sm);
    height: var(--size-touch-sm);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    transition:
      color var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .VaultPanel__pin-btn:hover:not(:disabled) {
    color: var(--foreground);
    background-color: var(--muted);
  }

  .VaultPanel__pin-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .VaultPanel__pin-btn--active {
    color: var(--interactive);
    background-color: var(--interactive-bg);
    border-color: color-mix(in oklch, var(--interactive) 30%, transparent);
  }

  .VaultPanel__pin-btn--active:hover:not(:disabled) {
    background-color: var(--interactive-bg-hover);
  }

  .VaultPanel__pin-btn:disabled {
    opacity: 0.6;
  }

  :global(.VaultPanel__pin-btn svg) {
    width: var(--size-icon);
    height: var(--size-icon);
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

  .VaultPanel__vault-path--disambiguated {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
    word-break: break-all;
  }

  .VaultPanel__vault-meta {
    margin-top: var(--space-1);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .VaultPanel__vault-count {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1-5);
  }

  .VaultPanel__vault-unavailable {
    color: var(--destructive);
    font-weight: 500;
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
