<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input'
  import SearchIcon from '@lucide/svelte/icons/search'
  import CommandIcon from '@lucide/svelte/icons/terminal'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import FilePlusIcon from '@lucide/svelte/icons/file-plus'
  import FolderOpenIcon from '@lucide/svelte/icons/folder-open'
  import type {
    CommandId,
    CommandDefinition,
    CommandIcon as CommandIconType
  } from '$lib/types/command_palette'
  import type { SettingDefinition } from '$lib/types/settings_registry'
  import type { Component } from 'svelte'

  const COMMAND_ICONS: Record<CommandIconType, Component> = {
    'file-plus': FilePlusIcon,
    'folder-open': FolderOpenIcon,
    'settings': SettingsIcon,
    'search': SearchIcon
  }

  type PaletteItem =
    | { type: 'command'; item: CommandDefinition }
    | { type: 'setting'; item: SettingDefinition }

  type Props = {
    open: boolean
    query: string
    selected_index: number
    commands: CommandDefinition[]
    settings: SettingDefinition[]
    on_open_change: (open: boolean) => void
    on_query_change: (query: string) => void
    on_selected_index_change: (index: number) => void
    on_select_command: (cmd: CommandId) => void
    on_select_setting: (key: string) => void
  }

  let {
    open,
    query,
    selected_index,
    commands,
    settings,
    on_open_change,
    on_query_change,
    on_selected_index_change,
    on_select_command,
    on_select_setting
  }: Props = $props()

  let input_ref: HTMLInputElement | null = $state(null)

  const filtered_commands = $derived(commands)
  const filtered_settings = $derived(settings)

  const items: PaletteItem[] = $derived([
    ...filtered_commands.map((cmd): PaletteItem => ({ type: 'command', item: cmd })),
    ...filtered_settings.map((setting): PaletteItem => ({ type: 'setting', item: setting }))
  ])

  const show_commands_header = $derived(filtered_commands.length > 0)
  const show_settings_header = $derived(filtered_settings.length > 0 && query.trim().length > 0)

  function get_item_id(item: PaletteItem): string {
    return item.type === 'command' ? `cmd-${item.item.id}` : `setting-${item.item.key}`
  }

  function handle_select(item: PaletteItem) {
    if (item.type === 'command') {
      on_select_command(item.item.id)
    } else {
      on_select_setting(item.item.key)
    }
  }

  function handle_keydown(event: KeyboardEvent) {
    if (!open) return

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        on_open_change(false)
        break
      case 'ArrowDown':
        event.preventDefault()
        if (items.length > 0) {
          on_selected_index_change((selected_index + 1) % items.length)
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (items.length > 0) {
          on_selected_index_change((selected_index - 1 + items.length) % items.length)
        }
        break
      case 'Enter':
        event.preventDefault()
        if (items[selected_index]) {
          handle_select(items[selected_index])
        }
        break
    }
  }

  $effect(() => {
    if (!open) return
    const ref = input_ref
    if (!ref) return
    setTimeout(() => { ref.focus() }, 0)
  })

  function commands_start_index(): number {
    return 0
  }

  function settings_start_index(): number {
    return filtered_commands.length
  }
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="CommandPalette" showCloseButton={false}>
    <div class="CommandPalette__search">
      <SearchIcon />
      <Input
        bind:ref={input_ref}
        type="text"
        placeholder="Search commands and settings..."
        value={query}
        oninput={(e: Event & { currentTarget: HTMLInputElement }) => { on_query_change(e.currentTarget.value); }}
        class="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>

    <div
      role="listbox"
      tabindex="0"
      aria-activedescendant={items[selected_index] ? get_item_id(items[selected_index]) : undefined}
      class="CommandPalette__list"
    >
      {#if show_commands_header}
        <div class="CommandPalette__header">
          <CommandIcon />
          <span>Commands</span>
        </div>
      {/if}

      {#each filtered_commands as command, index (command.id)}
        {@const global_index = commands_start_index() + index}
        {@const IconComponent = COMMAND_ICONS[command.icon]}
        <button
          id={`cmd-${command.id}`}
          role="option"
          aria-selected={global_index === selected_index}
          class="CommandPalette__item"
          class:CommandPalette__item--selected={global_index === selected_index}
          onmouseenter={() => { on_selected_index_change(global_index); }}
          onclick={() => { on_select_command(command.id); }}
        >
          <div class="CommandPalette__item-row">
            <span class="CommandPalette__item-icon"><IconComponent /></span>
            <span class="CommandPalette__item-title">{command.label}</span>
          </div>
          <div class="CommandPalette__item-desc">{command.description}</div>
        </button>
      {/each}

      {#if show_settings_header}
        <div class="CommandPalette__header CommandPalette__header--bordered">
          <SettingsIcon />
          <span>Settings</span>
        </div>
      {/if}

      {#each filtered_settings as setting, index (setting.key)}
        {@const global_index = settings_start_index() + index}
        <button
          id={`setting-${setting.key}`}
          role="option"
          aria-selected={global_index === selected_index}
          class="CommandPalette__item"
          class:CommandPalette__item--selected={global_index === selected_index}
          onmouseenter={() => { on_selected_index_change(global_index); }}
          onclick={() => { on_select_setting(setting.key); }}
        >
          <div class="CommandPalette__item-row">
            <span class="CommandPalette__item-title">{setting.label}</span>
            <span class="CommandPalette__badge">{setting.category}</span>
          </div>
          <div class="CommandPalette__item-desc">{setting.description}</div>
        </button>
      {/each}

      {#if items.length === 0}
        <div class="CommandPalette__empty">
          No results found
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<svelte:window onkeydown={handle_keydown} />

<style>
  :global(.CommandPalette) {
    max-width: var(--size-dialog-lg);
    padding: 0 !important;
    overflow: hidden;
  }

  .CommandPalette__search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  :global(.CommandPalette__search svg) {
    width: var(--size-icon);
    height: var(--size-icon);
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  .CommandPalette__list {
    max-height: var(--size-dialog-list-height);
    overflow-y: auto;
    padding-block: var(--space-2);
  }

  .CommandPalette__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .CommandPalette__header--bordered {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }

  :global(.CommandPalette__header svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  .CommandPalette__item {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-radius: 0;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .CommandPalette__item:focus {
    outline: none;
  }

  .CommandPalette__item--selected {
    background-color: var(--interactive-bg);
  }

  .CommandPalette__item--selected .CommandPalette__item-title {
    color: var(--interactive);
  }

  .CommandPalette__item-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .CommandPalette__item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-default);
  }

  :global(.CommandPalette__item-icon svg) {
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
  }

  .CommandPalette__item--selected .CommandPalette__item-icon {
    color: var(--interactive);
  }

  .CommandPalette__item-title {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--foreground);
  }

  .CommandPalette__item-desc {
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .CommandPalette__badge {
    font-size: var(--text-xs);
    padding: var(--space-0-5) var(--space-1-5);
    border-radius: var(--radius-sm);
    background-color: var(--muted);
    color: var(--muted-foreground);
  }

  .CommandPalette__empty {
    padding: var(--space-8) var(--space-3);
    text-align: center;
    font-size: var(--text-base);
    color: var(--muted-foreground);
  }
</style>
