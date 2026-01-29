<script lang="ts">
import { Button } from '$lib/components/ui/button'
import type { ThemeMode } from '$lib/state/app_state_machine'
import { Sun, Moon, Monitor } from '@lucide/svelte'

interface ThemeToggleProps {
  mode: ThemeMode
  on_change: (mode: ThemeMode) => void
}

let { mode, on_change }: ThemeToggleProps = $props()
</script>

<div class="theme-toggle__container">
  <Button
    variant={mode === 'light' ? 'default' : 'ghost'}
    size="sm"
    onclick={() => on_change('light')}
    aria-label="Light theme"
  >
    <Sun class="w-4 h-4" />
  </Button>
  <Button
    variant={mode === 'dark' ? 'default' : 'ghost'}
    size="sm"
    onclick={() => on_change('dark')}
    aria-label="Dark theme"
  >
    <Moon class="w-4 h-4" />
  </Button>
  <Button
    variant={mode === 'system' ? 'default' : 'ghost'}
    size="sm"
    onclick={() => on_change('system')}
    aria-label="System theme"
  >
    <Monitor class="w-4 h-4" />
  </Button>
</div>

<style>
.theme-toggle__container {
  display: flex;
  gap: 0.25rem;
}
</style>
