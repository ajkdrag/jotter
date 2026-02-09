<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Input } from "$lib/components/ui/input";
  import SearchIcon from "@lucide/svelte/icons/search";
  import FileIcon from "@lucide/svelte/icons/file-text";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import CommandIcon from "@lucide/svelte/icons/terminal";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import FilePlusIcon from "@lucide/svelte/icons/file-plus";
  import FolderOpenIcon from "@lucide/svelte/icons/folder-open";
  import type { OmnibarItem } from "$lib/types/search";
  import type { NoteMeta } from "$lib/types/note";
  import type { CommandIcon as CommandIconType } from "$lib/types/command_palette";
  import { COMMANDS_REGISTRY } from "$lib/utils/search_commands";
  import type { Component } from "svelte";

  const COMMAND_ICONS: Record<CommandIconType, Component> = {
    "file-plus": FilePlusIcon,
    "folder-open": FolderOpenIcon,
    settings: SettingsIcon,
  };

  type Props = {
    open: boolean;
    query: string;
    selected_index: number;
    is_searching: boolean;
    items: OmnibarItem[];
    recent_notes: NoteMeta[];
    on_open_change: (open: boolean) => void;
    on_query_change: (query: string) => void;
    on_selected_index_change: (index: number) => void;
    on_confirm: (item: OmnibarItem) => void;
  };

  let {
    open,
    query,
    selected_index,
    is_searching,
    items,
    recent_notes,
    on_open_change,
    on_query_change,
    on_selected_index_change,
    on_confirm,
  }: Props = $props();

  let input_ref: HTMLInputElement | null = $state(null);

  const is_command_mode = $derived(query.startsWith(">"));
  const has_query = $derived(
    query.trim().length > 0 && (!is_command_mode || query.trim().length > 1),
  );

  const display_items: OmnibarItem[] = $derived.by(() => {
    if (has_query) return items;

    if (is_command_mode) {
      return COMMANDS_REGISTRY.map((command) => ({
        kind: "command" as const,
        command,
        score: 0,
      }));
    }

    const recent: OmnibarItem[] = recent_notes.map((note) => ({
      kind: "recent_note" as const,
      note,
    }));
    const commands: OmnibarItem[] = COMMANDS_REGISTRY.map((command) => ({
      kind: "command" as const,
      command,
      score: 0,
    }));
    return [...recent, ...commands];
  });

  const show_recent_header = $derived(
    !has_query && !is_command_mode && recent_notes.length > 0,
  );
  const show_commands_header = $derived(
    !has_query && !is_command_mode && COMMANDS_REGISTRY.length > 0,
  );
  const commands_start_index = $derived(
    !has_query && !is_command_mode ? recent_notes.length : -1,
  );

  function get_item_id(item: OmnibarItem): string {
    switch (item.kind) {
      case "note":
        return `omni-note-${item.note.id}`;
      case "recent_note":
        return `omni-recent-${item.note.id}`;
      case "command":
        return `omni-cmd-${item.command.id}`;
      case "setting":
        return `omni-setting-${item.setting.key}`;
    }
  }

  function handle_keydown(event: KeyboardEvent) {
    if (!open) return;

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        on_open_change(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        if (display_items.length > 0) {
          on_selected_index_change((selected_index + 1) % display_items.length);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (display_items.length > 0) {
          on_selected_index_change(
            (selected_index - 1 + display_items.length) % display_items.length,
          );
        }
        break;
      case "Enter":
        event.preventDefault();
        if (display_items[selected_index]) {
          on_confirm(display_items[selected_index]);
        }
        break;
    }
  }

  $effect(() => {
    if (!open) return;
    const ref = input_ref;
    if (!ref) return;
    setTimeout(() => {
      ref.focus();
    }, 0);
  });
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="Omnibar" showCloseButton={false}>
    <div class="Omnibar__search">
      <SearchIcon />
      <Input
        bind:ref={input_ref}
        type="text"
        placeholder="Search notes, commands, settings..."
        value={query}
        oninput={(e: Event & { currentTarget: HTMLInputElement }) => {
          on_query_change(e.currentTarget.value);
        }}
        class="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {#if is_searching}
        <div class="Omnibar__spinner"></div>
      {/if}
    </div>

    <div
      role="listbox"
      tabindex="0"
      aria-activedescendant={display_items[selected_index]
        ? get_item_id(display_items[selected_index])
        : undefined}
      class="Omnibar__list"
    >
      {#if show_recent_header && recent_notes.length > 0}
        <div class="Omnibar__header">
          <ClockIcon />
          <span>Recent</span>
        </div>
      {/if}

      {#if show_commands_header && commands_start_index === 0}
        <div class="Omnibar__header">
          <CommandIcon />
          <span>Commands</span>
        </div>
      {/if}

      {#each display_items as item, index (get_item_id(item))}
        {#if show_commands_header && index === commands_start_index && commands_start_index > 0}
          <div class="Omnibar__header Omnibar__header--bordered">
            <CommandIcon />
            <span>Commands</span>
          </div>
        {/if}

        <button
          id={get_item_id(item)}
          role="option"
          aria-selected={index === selected_index}
          class="Omnibar__item"
          class:Omnibar__item--selected={index === selected_index}
          onmouseenter={() => {
            on_selected_index_change(index);
          }}
          onclick={() => {
            on_confirm(item);
          }}
        >
          {#if item.kind === "note"}
            <div class="Omnibar__item-row">
              <FileIcon />
              <div class="Omnibar__item-content">
                <span class="Omnibar__item-title">{item.note.title}</span>
                <span class="Omnibar__item-path">{item.note.path}</span>
                {#if item.snippet}
                  <span class="Omnibar__item-snippet">{item.snippet}</span>
                {/if}
              </div>
            </div>
          {:else if item.kind === "recent_note"}
            <div class="Omnibar__item-row">
              <ClockIcon />
              <div class="Omnibar__item-content">
                <span class="Omnibar__item-title">{item.note.title}</span>
                <span class="Omnibar__item-path">{item.note.path}</span>
              </div>
            </div>
          {:else if item.kind === "command"}
            {@const IconComponent = COMMAND_ICONS[item.command.icon]}
            <div class="Omnibar__item-row">
              <span class="Omnibar__item-icon"><IconComponent /></span>
              <span class="Omnibar__item-title">{item.command.label}</span>
            </div>
            <div class="Omnibar__item-desc">{item.command.description}</div>
          {:else if item.kind === "setting"}
            <div class="Omnibar__item-row">
              <SettingsIcon />
              <span class="Omnibar__item-title">{item.setting.label}</span>
              <span class="Omnibar__badge">{item.setting.category}</span>
            </div>
            <div class="Omnibar__item-desc">{item.setting.description}</div>
          {/if}
        </button>
      {/each}

      {#if display_items.length === 0}
        <div class="Omnibar__empty">
          {#if has_query}
            No results found
          {:else}
            No recent notes
          {/if}
        </div>
      {/if}
    </div>

    <div class="Omnibar__footer">
      <span class="Omnibar__hint"><kbd>&gt;</kbd> for commands</span>
      <span class="Omnibar__hint-sep">·</span>
      <span class="Omnibar__hint"
        ><kbd>title:</kbd> <kbd>path:</kbd> <kbd>content:</kbd></span
      >
    </div>
  </Dialog.Content>
</Dialog.Root>

<svelte:window onkeydown={handle_keydown} />

<style>
  :global(.Omnibar) {
    max-width: var(--size-dialog-lg);
    padding: 0 !important;
    overflow: hidden;
  }

  .Omnibar__search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  :global(.Omnibar__search svg) {
    width: var(--size-icon);
    height: var(--size-icon);
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  .Omnibar__spinner {
    width: var(--size-icon);
    height: var(--size-icon);
    border: 2px solid var(--muted-foreground);
    border-top-color: transparent;
    border-radius: 50%;
    flex-shrink: 0;
    animation: spin 1s linear infinite;
  }

  .Omnibar__list {
    max-height: var(--size-dialog-list-height);
    overflow-y: auto;
    padding-block: var(--space-2);
  }

  .Omnibar__header {
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

  .Omnibar__header--bordered {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }

  :global(.Omnibar__header svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  .Omnibar__item {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-radius: 0;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .Omnibar__item:focus {
    outline: none;
  }

  .Omnibar__item--selected {
    background-color: var(--interactive-bg);
  }

  .Omnibar__item--selected .Omnibar__item-title {
    color: var(--interactive);
  }

  .Omnibar__item-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  :global(.Omnibar__item-row svg) {
    width: var(--size-icon);
    height: var(--size-icon);
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  .Omnibar__item--selected :global(.Omnibar__item-row svg) {
    color: var(--interactive);
  }

  .Omnibar__item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-default);
  }

  :global(.Omnibar__item-icon svg) {
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
  }

  .Omnibar__item--selected .Omnibar__item-icon {
    color: var(--interactive);
  }

  .Omnibar__item-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .Omnibar__item-title {
    font-weight: 500;
    color: var(--foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .Omnibar__item-path,
  .Omnibar__item-snippet {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .Omnibar__item-desc {
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .Omnibar__badge {
    font-size: var(--text-xs);
    padding: var(--space-0-5) var(--space-1-5);
    border-radius: var(--radius-sm);
    background-color: var(--muted);
    color: var(--muted-foreground);
  }

  .Omnibar__empty {
    padding: var(--space-8) var(--space-3);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .Omnibar__footer {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1-5) var(--space-3);
    border-top: 1px solid var(--border);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .Omnibar__hint kbd {
    font-family: inherit;
    font-size: var(--text-xs);
    color: var(--foreground);
  }

  .Omnibar__hint-sep {
    color: var(--muted-foreground);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
