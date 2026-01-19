<script lang="ts">
  import { onMount } from 'svelte'
  import { set_theme, get_theme, get_effective_theme } from '$lib/utils/theme'

  let current_preference = $state<ReturnType<typeof get_theme>>(get_theme())
  let effective = $derived(get_effective_theme(current_preference))

  onMount(() => {
    const update = () => {
      current_preference = get_theme()
    }
    
    window.addEventListener('storage', update)
    const interval = setInterval(update, 100)
    
    return () => {
      window.removeEventListener('storage', update)
      clearInterval(interval)
    }
  })

  function toggle() {
    const next = effective === 'dark' ? 'light' : 'dark'
    set_theme(next)
    current_preference = get_theme()
  }
</script>

<button
  type="button"
  onclick={toggle}
  class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--background-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--control-border-focus)] focus:ring-offset-2"
  aria-label={effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
  {#if effective === 'dark'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-[var(--foreground-secondary)]"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  {:else}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-[var(--foreground-secondary)]"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  {/if}
</button>
