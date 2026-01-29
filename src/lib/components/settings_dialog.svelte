<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog/index.js'
import * as Select from '$lib/components/ui/select/index.js'
import * as Slider from '$lib/components/ui/slider/index.js'
import { Button } from '$lib/components/ui/button'
import { Separator } from '$lib/components/ui/separator'
import TypeIcon from '@lucide/svelte/icons/type'
import LayoutIcon from '@lucide/svelte/icons/layout-template'
import type { EditorSettings } from '$lib/types/editor_settings'

type Props = {
  open: boolean
  editor_settings: EditorSettings
  is_saving: boolean
  has_unsaved_changes: boolean
  error: string | null
  on_update_settings: (settings: EditorSettings) => void
  on_save: () => void
  on_close: () => void
}

let { open, editor_settings, is_saving, has_unsaved_changes, error, on_update_settings, on_save, on_close }: Props = $props()

let font_size_value = $derived(editor_settings.font_size)
let line_height_value = $derived(editor_settings.line_height)

function handle_font_size_change(value: number) {
  editor_settings.font_size = value
  on_update_settings(editor_settings)
}

function handle_line_height_change(value: number) {
  editor_settings.line_height = value
  on_update_settings(editor_settings)
}

function handle_heading_color_change(value: string | undefined) {
  if (value) {
    editor_settings.heading_color = value as EditorSettings['heading_color']
    on_update_settings(editor_settings)
  }
}

function handle_spacing_change(value: string | undefined) {
  if (value) {
    editor_settings.spacing = value as EditorSettings['spacing']
    on_update_settings(editor_settings)
  }
}

const heading_color_options = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'primary', label: 'Primary' },
  { value: 'accent', label: 'Accent' }
]

const spacing_options = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'spacious', label: 'Spacious' }
]
</script>

<Dialog.Root {open} onOpenChange={(value: boolean) => { if (!value) on_close() }}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-lg font-semibold">Settings</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Customize your editor experience
      </Dialog.Description>
    </Dialog.Header>

    <div class="settings">
      <section class="settings__section">
        <div class="settings__section-header">
          <TypeIcon class="size-4 text-muted-foreground" />
          <span class="settings__section-label">Typography</span>
        </div>
        
        <div class="settings__group">
          <div class="settings__field">
            <div class="settings__field-header">
              <span class="settings__field-label">Font Size</span>
              <span class="settings__field-value">{editor_settings.font_size.toFixed(2)}rem</span>
            </div>
            <Slider.Root
              type="single"
              value={font_size_value}
              onValueChange={handle_font_size_change}
              min={0.875}
              max={1.25}
              step={0.0625}
              class="w-full"
            />
          </div>

          <div class="settings__field">
            <div class="settings__field-header">
              <span class="settings__field-label">Line Height</span>
              <span class="settings__field-value">{editor_settings.line_height.toFixed(2)}</span>
            </div>
            <Slider.Root
              type="single"
              value={line_height_value}
              onValueChange={handle_line_height_change}
              min={1.5}
              max={2.0}
              step={0.05}
              class="w-full"
            />
          </div>

          <div class="settings__field settings__field--inline">
            <span class="settings__field-label">Heading Color</span>
            <Select.Root type="single" value={editor_settings.heading_color} onValueChange={handle_heading_color_change}>
              <Select.Trigger class="w-32">
                {heading_color_options.find(o => o.value === editor_settings.heading_color)?.label}
              </Select.Trigger>
              <Select.Content>
                {#each heading_color_options as option}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </section>

      <Separator />

      <section class="settings__section">
        <div class="settings__section-header">
          <LayoutIcon class="size-4 text-muted-foreground" />
          <span class="settings__section-label">Layout</span>
        </div>
        
        <div class="settings__group">
          <div class="settings__field settings__field--inline">
            <span class="settings__field-label">Content Spacing</span>
            <Select.Root type="single" value={editor_settings.spacing} onValueChange={handle_spacing_change}>
              <Select.Trigger class="w-32">
                {spacing_options.find(o => o.value === editor_settings.spacing)?.label}
              </Select.Trigger>
              <Select.Content>
                {#each spacing_options as option}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </section>
    </div>

    <Dialog.Footer class="settings__footer">
      {#if error}
        <span class="text-destructive text-sm mr-auto">{error}</span>
      {/if}
      <Button variant="outline" onclick={on_close}>Cancel</Button>
      <Button
        onclick={on_save}
        disabled={!has_unsaved_changes || is_saving}
      >
        {is_saving ? 'Saving...' : has_unsaved_changes ? 'Save Changes' : 'Saved'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.settings__section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings__section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings__section-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
}

.settings__group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings__field {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings__field--inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings__field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
}

.settings__field-value {
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--muted-foreground);
  background: var(--muted);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
}

:global(.settings__footer) {
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
</style>
