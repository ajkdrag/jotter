<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input'
  import SearchIcon from '@lucide/svelte/icons/search'
  import CommandIcon from '@lucide/svelte/icons/terminal'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import { search_commands, type CommandId, type CommandDefinition } from '$lib/operations/search_commands'
  import { search_settings, type SettingDefinition } from '$lib/operations/search_settings'

  type PaletteItem =
    | { type: 'command'; item: CommandDefinition }
    | { type: 'setting'; item: SettingDefinition }

  type Props = {
    open: boolean
    query: string
    selected_index: number
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
    on_open_change,
    on_query_change,
    on_selected_index_change,
    on_select_command,
    on_select_setting
  }: Props = $props()

  let input_ref: HTMLInputElement | null = $state(null)

  const filtered_commands = $derived(search_commands(query))
  const filtered_settings = $derived(search_settings(query))

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
    if (open && input_ref) {
      setTimeout(() => input_ref?.focus(), 0)
    }
  })

  function commands_start_index(): number {
    return 0
  }

  function settings_start_index(): number {
    return filtered_commands.length
  }
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="max-w-lg p-0" showCloseButton={false}>
    <div class="flex items-center border-b px-3">
      <SearchIcon class="size-4 text-muted-foreground shrink-0" />
      <Input
        bind:ref={input_ref}
        type="text"
        placeholder="Search commands and settings..."
        value={query}
        oninput={(e) => on_query_change(e.currentTarget.value)}
        class="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>

    <div
      role="listbox"
      tabindex="0"
      aria-activedescendant={items[selected_index] ? get_item_id(items[selected_index]) : undefined}
      class="max-h-80 overflow-y-auto py-2"
    >
      {#if show_commands_header}
        <div class="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <CommandIcon class="size-3" />
          <span>Commands</span>
        </div>
      {/if}

      {#each filtered_commands as command, index (command.id)}
        {@const global_index = commands_start_index() + index}
        <button
          id={`cmd-${command.id}`}
          role="option"
          aria-selected={global_index === selected_index}
          class="w-full px-3 py-2 text-left transition-colors focus:outline-none"
          class:bg-muted={global_index === selected_index}
          onmouseenter={() => on_selected_index_change(global_index)}
          onclick={() => on_select_command(command.id)}
        >
          <div class="font-medium text-foreground">{command.label}</div>
          <div class="text-sm text-muted-foreground">{command.description}</div>
        </button>
      {/each}

      {#if show_settings_header}
        <div class="flex items-center gap-2 px-3 py-1.5 mt-2 text-xs text-muted-foreground border-t pt-2">
          <SettingsIcon class="size-3" />
          <span>Settings</span>
        </div>
      {/if}

      {#each filtered_settings as setting, index (setting.key)}
        {@const global_index = settings_start_index() + index}
        <button
          id={`setting-${setting.key}`}
          role="option"
          aria-selected={global_index === selected_index}
          class="w-full px-3 py-2 text-left transition-colors focus:outline-none"
          class:bg-muted={global_index === selected_index}
          onmouseenter={() => on_selected_index_change(global_index)}
          onclick={() => on_select_setting(setting.key)}
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-foreground">{setting.label}</span>
            <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{setting.category}</span>
          </div>
          <div class="text-sm text-muted-foreground">{setting.description}</div>
        </button>
      {/each}

      {#if items.length === 0}
        <div class="px-3 py-8 text-center text-sm text-muted-foreground">
          No results found
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<svelte:window onkeydown={handle_keydown} />
