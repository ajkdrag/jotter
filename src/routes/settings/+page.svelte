<script lang="ts">
import { Button } from '$lib/components/ui/button'
import { Card } from '$lib/components/ui/card'
import ThemeToggle from '$lib/components/theme_toggle.svelte'
import { create_prod_ports } from '$lib/adapters/create_prod_ports'
import { ArrowLeft } from '@lucide/svelte'

const ports = create_prod_ports()

let current_theme = $state(ports.theme.get_theme())

function handle_theme_change(theme: 'light' | 'dark' | 'system') {
  ports.theme.set_theme(theme)
  current_theme = theme
}
</script>

<div class="settings">
  <div class="settings__header">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/" class="settings__back-link" data-sveltekit-preload-data="hover">
      <Button variant="ghost" size="sm" class="settings__back-button">
        <ArrowLeft class="w-4 h-4" />
        Back
      </Button>
    </a>
    <h1 class="settings__title">Settings</h1>
  </div>

  <div class="settings__section-wrapper">
    <Card class="settings__section-card">
      <div class="settings__section-header">
        <h2 class="settings__section-title">Appearance</h2>
      </div>
      <div class="settings__section-content">
        <div class="settings__row">
          <div class="settings__label">
            <span>Theme</span>
            <span class="settings__description">Choose your preferred color scheme</span>
          </div>
          <ThemeToggle mode={current_theme} on_change={handle_theme_change} />
        </div>
      </div>
    </Card>

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
</div>

<style>
.settings {
  padding: 2rem;
  max-width: 60rem;
  margin: 0 auto;
}

.settings__header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.settings__title {
  font-size: 1.875rem;
  font-weight: 700;
}

.settings__section-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.settings__back-link {
  text-decoration: none;
  align-self: flex-start;
}

:global(.settings__back-button) {
  align-self: flex-start;
}
</style>
