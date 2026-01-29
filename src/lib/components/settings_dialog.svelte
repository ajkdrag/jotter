<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog/index.js'
import { Card } from '$lib/components/ui/card'
import { Button } from '$lib/components/ui/button'
import { onMount } from 'svelte'
import { load_editor_settings, save_editor_settings } from '$lib/operations/load_editor_settings'
import { apply_editor_styles } from '$lib/operations/apply_editor_styles'
import type { EditorSettings } from '$lib/types/editor_settings'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

type Props = {
  open: boolean
  on_open_change: (open: boolean) => void
  settings_port: import('$lib/ports/settings_port').SettingsPort
}

let { open, on_open_change, settings_port }: Props = $props()

let editor_settings = $state<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
let has_unsaved_changes = $state(false)
let is_saving = $state(false)

onMount(async () => {
  editor_settings = await load_editor_settings(settings_port)
  apply_editor_styles(editor_settings)
})

function handle_setting_change() {
  apply_editor_styles(editor_settings)
  has_unsaved_changes = true
}

async function handle_save() {
  is_saving = true
  try {
    await save_editor_settings(settings_port, editor_settings)
    has_unsaved_changes = false
  } finally {
    is_saving = false
  }
}
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="max-w-200 max-h-[80vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Settings</Dialog.Title>
    </Dialog.Header>

    <div class="settings__section-wrapper">
      <Card class="settings__section-card">
        <div class="settings__section-header">
          <h2 class="settings__section-title">Editor Typography</h2>
        </div>
        <div class="settings__section-content">
          <div class="settings__row">
            <div class="settings__label">
              <span>Font Size</span>
              <span class="settings__description">Base font size: {editor_settings.font_size.toFixed(2)}rem</span>
            </div>
            <div class="settings__control">
              <input
                type="range"
                min="0.875"
                max="1.25"
                step="0.0625"
                bind:value={editor_settings.font_size}
                oninput={handle_setting_change}
                class="settings__slider"
              />
            </div>
          </div>

          <div class="settings__row">
            <div class="settings__label">
              <span>Line Height</span>
              <span class="settings__description">Line spacing: {editor_settings.line_height.toFixed(2)}</span>
            </div>
            <div class="settings__control">
              <input
                type="range"
                min="1.5"
                max="2.0"
                step="0.05"
                bind:value={editor_settings.line_height}
                oninput={handle_setting_change}
                class="settings__slider"
              />
            </div>
          </div>

          <div class="settings__row">
            <div class="settings__label">
              <span>Heading Color</span>
              <span class="settings__description">Color scheme for headings</span>
            </div>
            <div class="settings__control">
              <select
                bind:value={editor_settings.heading_color}
                onchange={handle_setting_change}
                class="settings__select"
              >
                <option value="inherit">Inherit</option>
                <option value="primary">Primary</option>
                <option value="accent">Accent</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card class="settings__section-card">
        <div class="settings__section-header">
          <h2 class="settings__section-title">Editor Layout</h2>
        </div>
        <div class="settings__section-content">
          <div class="settings__row">
            <div class="settings__label">
              <span>Spacing</span>
              <span class="settings__description">Content density and margins</span>
            </div>
            <div class="settings__control">
              <select
                bind:value={editor_settings.spacing}
                onchange={handle_setting_change}
                class="settings__select"
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <Dialog.Footer class="settings__footer">
      <Button
        onclick={handle_save}
        disabled={!has_unsaved_changes || is_saving}
        class="settings__save-button"
      >
        {is_saving ? 'Saving...' : has_unsaved_changes ? 'Save Changes' : 'Saved'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
.settings__section-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1rem;
}

:global(.settings__section-card) {
  padding: 1.5rem;
}

.settings__section-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.settings__section-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.settings__section-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings__label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.settings__description {
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.settings__control {
  min-width: 200px;
}

.settings__slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--muted);
  outline: none;
  cursor: pointer;
}

.settings__slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  transition: background 0.2s;
}

.settings__slider::-webkit-slider-thumb:hover {
  background: var(--primary);
  opacity: 0.9;
}

.settings__slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.settings__slider::-moz-range-thumb:hover {
  background: var(--primary);
  opacity: 0.9;
}

.settings__select {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.settings__select:hover {
  border-color: var(--border-strong);
}

.settings__select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 20%, transparent);
}

:global(.settings__footer) {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}
</style>
