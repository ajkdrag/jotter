<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Slider from "$lib/components/ui/slider/index.js";
  import * as Switch from "$lib/components/ui/switch/index.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import TypeIcon from "@lucide/svelte/icons/type";
  import LayoutIcon from "@lucide/svelte/icons/layout-template";
  import Link2Icon from "@lucide/svelte/icons/link-2";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import SlidersIcon from "@lucide/svelte/icons/sliders-horizontal";
  import type {
    EditorSettings,
    SettingsCategory,
  } from "$lib/types/editor_settings";

  type Props = {
    open: boolean;
    editor_settings: EditorSettings;
    active_category: SettingsCategory;
    is_saving: boolean;
    has_unsaved_changes: boolean;
    error: string | null;
    on_update_settings: (settings: EditorSettings) => void;
    on_category_change: (category: SettingsCategory) => void;
    on_save: () => void;
    on_close: () => void;
  };

  let {
    open,
    editor_settings,
    active_category,
    is_saving,
    has_unsaved_changes,
    error,
    on_update_settings,
    on_category_change,
    on_save,
    on_close,
  }: Props = $props();

  let font_size_value = $derived(editor_settings.font_size);
  let line_height_value = $derived(editor_settings.line_height);
  let max_open_tabs_value = $derived(editor_settings.max_open_tabs);

  function update<K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K],
  ) {
    on_update_settings({ ...editor_settings, [key]: value });
  }

  function update_select<K extends keyof EditorSettings>(
    key: K,
    value: string | undefined,
  ) {
    if (value) update(key, value as EditorSettings[K]);
  }

  const categories: {
    id: SettingsCategory;
    label: string;
    icon: typeof TypeIcon;
  }[] = [
    { id: "typography", label: "Typography", icon: TypeIcon },
    { id: "layout", label: "Layout", icon: LayoutIcon },
    { id: "links", label: "Links", icon: Link2Icon },
    { id: "files", label: "Files", icon: FolderIcon },
    { id: "git", label: "Git", icon: GitBranchIcon },
    { id: "misc", label: "Misc", icon: SlidersIcon },
  ];

  const heading_color_options = [
    { value: "inherit", label: "Inherit" },
    { value: "primary", label: "Primary" },
    { value: "accent", label: "Accent" },
  ];

  const spacing_options = [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "spacious", label: "Spacious" },
  ];

  const link_syntax_options = [
    { value: "wikilink", label: "Wikilinks ([[note]])" },
    { value: "markdown", label: "Markdown links ([note](note.md))" },
  ];
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value && !is_saving) on_close();
  }}
>
  <Dialog.Content class="SettingsDialog">
    <Dialog.Header class="sr-only">
      <Dialog.Title>Settings</Dialog.Title>
      <Dialog.Description>Customize your editor experience</Dialog.Description>
    </Dialog.Header>

    <div class="SettingsDialog__panels">
      <nav class="SettingsDialog__nav">
        <div class="SettingsDialog__nav-header">Settings</div>
        {#each categories as cat (cat.id)}
          <button
            class="SettingsDialog__nav-item"
            class:SettingsDialog__nav-item--selected={active_category ===
              cat.id}
            onclick={() => {
              on_category_change(cat.id);
            }}
          >
            <cat.icon />
            <span>{cat.label}</span>
          </button>
        {/each}
      </nav>

      <div class="SettingsDialog__content">
        {#if active_category === "typography"}
          <h2 class="SettingsDialog__content-header">Typography</h2>

          <div class="SettingsDialog__section-content">
            <div class="SettingsDialog__row--stacked">
              <div class="flex items-center justify-between">
                <span class="SettingsDialog__label">Font Size</span>
                <span class="SettingsDialog__badge"
                  >{editor_settings.font_size.toFixed(2)}rem</span
                >
              </div>
              <Slider.Root
                type="single"
                value={font_size_value}
                onValueChange={(v: number) => {
                  update("font_size", v);
                }}
                min={0.875}
                max={1.25}
                step={0.0625}
                class="w-full"
              />
            </div>

            <div class="SettingsDialog__row--stacked">
              <div class="flex items-center justify-between">
                <span class="SettingsDialog__label">Line Height</span>
                <span class="SettingsDialog__badge"
                  >{editor_settings.line_height.toFixed(2)}</span
                >
              </div>
              <Slider.Root
                type="single"
                value={line_height_value}
                onValueChange={(v: number) => {
                  update("line_height", v);
                }}
                min={1.5}
                max={2.0}
                step={0.05}
                class="w-full"
              />
            </div>

            <div class="SettingsDialog__row">
              <span class="SettingsDialog__label">Heading Color</span>
              <Select.Root
                type="single"
                value={editor_settings.heading_color}
                onValueChange={(v: string | undefined) => {
                  update_select("heading_color", v);
                }}
              >
                <Select.Trigger class="w-32">
                  <span data-slot="select-value">
                    {heading_color_options.find(
                      (o) => o.value === editor_settings.heading_color,
                    )?.label}
                  </span>
                </Select.Trigger>
                <Select.Content>
                  {#each heading_color_options as option (option.value)}
                    <Select.Item value={option.value}
                      >{option.label}</Select.Item
                    >
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        {:else if active_category === "layout"}
          <h2 class="SettingsDialog__content-header">Layout</h2>

          <div class="SettingsDialog__section-content">
            <div class="SettingsDialog__row">
              <span class="SettingsDialog__label">Content Spacing</span>
              <Select.Root
                type="single"
                value={editor_settings.spacing}
                onValueChange={(v: string | undefined) => {
                  update_select("spacing", v);
                }}
              >
                <Select.Trigger class="w-32">
                  <span data-slot="select-value">
                    {spacing_options.find(
                      (o) => o.value === editor_settings.spacing,
                    )?.label}
                  </span>
                </Select.Trigger>
                <Select.Content>
                  {#each spacing_options as option (option.value)}
                    <Select.Item value={option.value}
                      >{option.label}</Select.Item
                    >
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="SettingsDialog__row--stacked">
              <div class="flex items-center justify-between">
                <div class="SettingsDialog__label-group">
                  <span class="SettingsDialog__label">Max Open Tabs</span>
                  <span class="SettingsDialog__description"
                    >Limit the number of tabs for better performance (1–10)</span
                  >
                </div>
                <span class="SettingsDialog__badge"
                  >{editor_settings.max_open_tabs}</span
                >
              </div>
              <Slider.Root
                type="single"
                value={max_open_tabs_value}
                onValueChange={(v: number) => {
                  update(
                    "max_open_tabs",
                    Math.min(10, Math.max(1, Math.round(v))),
                  );
                }}
                min={1}
                max={10}
                step={1}
                class="w-full"
              />
            </div>
          </div>
        {:else if active_category === "links"}
          <h2 class="SettingsDialog__content-header">Links</h2>

          <div class="SettingsDialog__section-content">
            <div class="SettingsDialog__row">
              <span class="SettingsDialog__label">Save Link Syntax</span>
              <Select.Root
                type="single"
                value={editor_settings.link_syntax}
                onValueChange={(v: string | undefined) => {
                  update_select("link_syntax", v);
                }}
              >
                <Select.Trigger class="w-56">
                  <span data-slot="select-value">
                    {link_syntax_options.find(
                      (o) => o.value === editor_settings.link_syntax,
                    )?.label}
                  </span>
                </Select.Trigger>
                <Select.Content>
                  {#each link_syntax_options as option (option.value)}
                    <Select.Item value={option.value}
                      >{option.label}</Select.Item
                    >
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        {:else if active_category === "files"}
          <h2 class="SettingsDialog__content-header">Files</h2>

          <div class="SettingsDialog__section-content">
            <div class="SettingsDialog__row">
              <span class="SettingsDialog__label">Attachment Folder</span>
              <Input
                type="text"
                value={editor_settings.attachment_folder}
                onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
                  update("attachment_folder", e.currentTarget.value);
                }}
                oninput={(e: Event & { currentTarget: HTMLInputElement }) => {
                  update("attachment_folder", e.currentTarget.value);
                }}
                class="w-48"
                placeholder=".assets"
              />
            </div>
            <div class="SettingsDialog__row">
              <div class="SettingsDialog__label-group">
                <span class="SettingsDialog__label">Show Hidden Files</span>
                <span class="SettingsDialog__description"
                  >Show dot-prefixed files and folders in the file tree</span
                >
              </div>
              <Switch.Root
                checked={editor_settings.show_hidden_files}
                onCheckedChange={(v: boolean) => {
                  update("show_hidden_files", v);
                }}
              />
            </div>
            <div class="SettingsDialog__row">
              <div class="SettingsDialog__label-group">
                <span class="SettingsDialog__label">Autosave</span>
                <span class="SettingsDialog__description"
                  >Automatically save Markdown notes after edits</span
                >
              </div>
              <Switch.Root
                checked={editor_settings.autosave_enabled}
                onCheckedChange={(v: boolean) => {
                  update("autosave_enabled", v);
                }}
              />
            </div>
          </div>
        {:else if active_category === "git"}
          <h2 class="SettingsDialog__content-header">Git</h2>

          <div class="SettingsDialog__section-content">
            <div class="SettingsDialog__row">
              <div class="SettingsDialog__label-group">
                <span class="SettingsDialog__label">Auto-commit</span>
                <span class="SettingsDialog__description"
                  >Automatically commit saved changes to Git</span
                >
              </div>
              <Switch.Root
                checked={editor_settings.git_autocommit_enabled}
                onCheckedChange={(v: boolean) => {
                  update("git_autocommit_enabled", v);
                }}
              />
            </div>
          </div>
        {:else if active_category === "misc"}
          <h2 class="SettingsDialog__content-header">Misc</h2>

          <div class="SettingsDialog__section-content">
            <div class="SettingsDialog__row">
              <div class="SettingsDialog__label-group">
                <span class="SettingsDialog__label"
                  >Show Vault Dashboard on Open</span
                >
                <span class="SettingsDialog__description"
                  >Open the vault dashboard automatically when a vault is opened</span
                >
              </div>
              <Switch.Root
                checked={editor_settings.show_vault_dashboard_on_open}
                onCheckedChange={(v: boolean) => {
                  update("show_vault_dashboard_on_open", v);
                }}
              />
            </div>
          </div>
        {/if}
      </div>
    </div>

    <Dialog.Footer class="SettingsDialog__footer">
      {#if error}
        <span class="text-destructive text-sm mr-auto">{error}</span>
      {/if}
      <Button
        variant="outline"
        class="transition-colors"
        onclick={on_close}
        disabled={is_saving}
      >
        Cancel
      </Button>
      <Button
        class="transition-colors"
        onclick={on_save}
        disabled={!has_unsaved_changes || is_saving}
      >
        {is_saving
          ? "Saving..."
          : has_unsaved_changes
            ? "Save Changes"
            : "Saved"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.SettingsDialog) {
    max-width: 52rem;
    width: 52rem;
    height: 80vh;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    padding: 0;
    gap: 0;
    overflow: hidden;
  }

  .SettingsDialog__panels {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .SettingsDialog__nav {
    display: flex;
    flex-direction: column;
    width: 12rem;
    min-width: 12rem;
    padding: var(--space-3);
    gap: var(--space-0-5);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }

  .SettingsDialog__nav-header {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground);
    padding: var(--space-2) var(--space-2) var(--space-3);
  }

  .SettingsDialog__nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    width: 100%;
    min-height: var(--size-touch);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .SettingsDialog__nav-item:hover {
    background-color: var(--muted);
    color: var(--foreground);
  }

  .SettingsDialog__nav-item--selected {
    background-color: var(--interactive-bg);
    color: var(--interactive);
  }

  .SettingsDialog__nav-item--selected:hover {
    background-color: var(--interactive-bg-hover);
    color: var(--interactive);
  }

  .SettingsDialog__nav-item :global(svg) {
    width: var(--size-icon);
    height: var(--size-icon);
    flex-shrink: 0;
  }

  .SettingsDialog__content {
    flex: 1;
    padding: var(--space-6);
    overflow-y: auto;
    min-height: 0;
  }

  .SettingsDialog__content-header {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--foreground);
    margin-bottom: var(--space-6);
  }

  .SettingsDialog__section-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .SettingsDialog__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .SettingsDialog__row--stacked {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .SettingsDialog__label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground);
  }

  .SettingsDialog__label-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .SettingsDialog__description {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    line-height: 1.4;
  }

  .SettingsDialog__badge {
    font-size: var(--text-xs);
    font-family: var(--font-mono, ui-monospace, monospace);
    color: var(--muted-foreground);
    background-color: var(--muted);
    padding: var(--space-0-5) var(--space-2);
    border-radius: var(--radius-sm, 4px);
  }

  :global(.SettingsDialog__footer) {
    padding: var(--space-3) var(--space-6);
    border-top: 1px solid var(--border);
  }
</style>
