<script lang="ts">
import type { ThemeMode } from '$lib/types/theme'
import { Sun, Moon, Monitor } from '@lucide/svelte'

interface ThemeToggleProps {
  mode: ThemeMode
  on_change: (mode: ThemeMode) => void
}

let { mode, on_change }: ThemeToggleProps = $props()
</script>

<div class="ThemeToggle" role="radiogroup" aria-label="Theme selection">
  <button
    type="button"
    class="ThemeToggle__option"
    class:ThemeToggle__option--active={mode === 'light'}
    onclick={() => { on_change('light'); }}
    role="radio"
    aria-checked={mode === 'light'}
    aria-label="Light theme"
  >
    <Sun />
  </button>
  <button
    type="button"
    class="ThemeToggle__option"
    class:ThemeToggle__option--active={mode === 'dark'}
    onclick={() => { on_change('dark'); }}
    role="radio"
    aria-checked={mode === 'dark'}
    aria-label="Dark theme"
  >
    <Moon />
  </button>
  <button
    type="button"
    class="ThemeToggle__option"
    class:ThemeToggle__option--active={mode === 'system'}
    onclick={() => { on_change('system'); }}
    role="radio"
    aria-checked={mode === 'system'}
    aria-label="System theme"
  >
    <Monitor />
  </button>
</div>

<style>
  .ThemeToggle {
    display: flex;
    gap: 1px;
    padding: 2px;
    background-color: var(--muted);
    border-radius: var(--radius-md);
  }

  .ThemeToggle__option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-touch-sm);
    height: var(--size-touch-sm);
    border-radius: calc(var(--radius-md) - 2px);
    color: var(--muted-foreground);
    transition:
      color var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default);
  }

  .ThemeToggle__option:hover:not(.ThemeToggle__option--active) {
    color: var(--foreground);
  }

  .ThemeToggle__option:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .ThemeToggle__option--active {
    background-color: var(--background);
    color: var(--interactive);
    box-shadow: var(--shadow-xs);
  }

  :global(.ThemeToggle__option svg) {
    width: var(--size-icon);
    height: var(--size-icon);
  }
</style>
