<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog/index.js'
import { Card } from '$lib/components/ui/card'

type Props = {
  open: boolean
  on_open_change: (open: boolean) => void
}

let { open, on_open_change }: Props = $props()
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="max-w-200 max-h-[80vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Settings</Dialog.Title>
    </Dialog.Header>

    <div class="settings__section-wrapper">
      <Card class="settings__section-card">
        <div class="settings__section-header">
          <h2 class="settings__section-title">Typography</h2>
        </div>
        <div class="settings__section-content">
          <div class="settings__row">
            <div class="settings__label">
              <span>Font Size</span>
              <span class="settings__description">Adjust base font size (coming soon)</span>
            </div>
            <div class="settings__control-placeholder">Not implemented yet</div>
          </div>
        </div>
      </Card>

      <Card class="settings__section-card">
        <div class="settings__section-header">
          <h2 class="settings__section-title">Layout</h2>
        </div>
        <div class="settings__section-content">
          <div class="settings__row">
            <div class="settings__label">
              <span>Spacing</span>
              <span class="settings__description">Adjust content density (coming soon)</span>
            </div>
            <div class="settings__control-placeholder">Not implemented yet</div>
          </div>
        </div>
      </Card>
    </div>
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

.settings__control-placeholder {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  font-style: italic;
}
</style>
