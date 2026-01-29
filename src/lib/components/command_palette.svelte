<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js"

  type CommandId = 'create_new_note' | 'change_vault' | 'open_settings'

  type Props = {
    open: boolean
    on_open_change: (open: boolean) => void
    selected_index: number
    on_selected_index_change: (index: number) => void
    on_select_command: (cmd: CommandId) => void
  }

  let {
    open,
    on_open_change,
    selected_index,
    on_selected_index_change,
    on_select_command
  }: Props = $props()

  const commands: Array<{ id: CommandId; label: string; description: string }> = [
    {
      id: 'create_new_note',
      label: 'Create new note',
      description: 'Create an untitled note in the current folder'
    },
    {
      id: 'change_vault',
      label: 'Change vault',
      description: 'Switch to a different vault'
    },
    {
      id: 'open_settings',
      label: 'Settings',
      description: 'Open application settings'
    }
  ]

  function handle_keydown(event: KeyboardEvent) {
    if (!open) return

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        on_open_change(false)
        break
      case 'ArrowDown':
        event.preventDefault()
        on_selected_index_change((selected_index + 1) % commands.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        on_selected_index_change((selected_index - 1 + commands.length) % commands.length)
        break
      case 'Enter':
        event.preventDefault()
        if (commands[selected_index]) {
          on_select_command(commands[selected_index].id)
        }
        break
    }
  }
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="max-w-125" showCloseButton={false}>
    <Dialog.Header>
      <Dialog.Title>Command Palette</Dialog.Title>
    </Dialog.Header>
    <div role="listbox" aria-activedescendant={commands[selected_index] ? `command-${commands[selected_index].id}` : undefined} tabindex="0" class="py-2">
      {#each commands as command, index (command.id)}
        <button
          id={`command-${command.id}`}
          role="option"
          aria-selected={index === selected_index}
          class="w-full px-4 py-3 text-left transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          class:bg-muted={index === selected_index}
          onmouseenter={() => on_selected_index_change(index)}
          onclick={() => on_select_command(command.id)}
        >
          <div class="font-medium text-foreground">{command.label}</div>
          <div class="text-sm text-muted-foreground">{command.description}</div>
        </button>
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>

<svelte:window onkeydown={handle_keydown} />
