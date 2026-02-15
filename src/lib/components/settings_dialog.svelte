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
  import type { EditorSettings } from "$lib/types/editor_settings";

  type Props = {
    open: boolean;
    editor_settings: EditorSettings;
    is_saving: boolean;
    has_unsaved_changes: boolean;
    error: string | null;
    on_update_settings: (settings: EditorSettings) => void;
    on_save: () => void;
    on_close: () => void;
  };

  let {
    open,
    editor_settings,
    is_saving,
    has_unsaved_changes,
    error,
    on_update_settings,
    on_save,
    on_close,
  }: Props = $props();

  let font_size_value = $derived(editor_settings.font_size);
  let line_height_value = $derived(editor_settings.line_height);

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
    <Dialog.Header>
      <Dialog.Title class="text-lg font-semibold">Settings</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Customize your editor experience
      </Dialog.Description>
    </Dialog.Header>

    <div class="SettingsDialog__body">
      <section class="SettingsDialog__section">
        <div class="SettingsDialog__section-header">
          <TypeIcon class="size-4 text-muted-foreground" />
          <span>Typography</span>
        </div>

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
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </section>

      <section class="SettingsDialog__section">
        <div class="SettingsDialog__section-header">
          <LayoutIcon class="size-4 text-muted-foreground" />
          <span>Layout</span>
        </div>

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
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </section>

      <section class="SettingsDialog__section">
        <div class="SettingsDialog__section-header">
          <Link2Icon class="size-4 text-muted-foreground" />
          <span>Links</span>
        </div>

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
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </section>

      <section class="SettingsDialog__section">
        <div class="SettingsDialog__section-header">
          <FolderIcon class="size-4 text-muted-foreground" />
          <span>Files</span>
        </div>

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
      </section>

      <section class="SettingsDialog__section">
        <div class="SettingsDialog__section-header">
          <GitBranchIcon class="size-4 text-muted-foreground" />
          <span>Git</span>
        </div>

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
      </section>

      <section class="SettingsDialog__section">
        <div class="SettingsDialog__section-header">
          <SlidersIcon class="size-4 text-muted-foreground" />
          <span>Misc</span>
        </div>

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
      </section>
    </div>

    <Dialog.Footer class="pt-4 border-t">
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
    max-width: var(--size-dialog-lg);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .SettingsDialog__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3) var(--space-2) 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    min-height: 0;
  }

  .SettingsDialog__section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) 0;
  }

  .SettingsDialog__section + .SettingsDialog__section {
    border-top: 1px solid var(--border);
  }

  .SettingsDialog__section-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .SettingsDialog__section-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-left: var(--space-6);
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
</style>
