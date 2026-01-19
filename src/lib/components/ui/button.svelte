<script lang="ts">
  import { cn } from '$lib/components/ui/cn'

  export let variant: 'default' | 'outline' | 'ghost' = 'default'
  export let class_name: string = ''
</script>

<button
  class={cn(
    'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold tracking-tight transition',
    'ring-1 ring-inset ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
    variant === 'default' && 'bg-fg text-bg hover:bg-fg/90',
    variant === 'outline' && 'bg-transparent text-fg hover:bg-panel2',
    variant === 'ghost' && 'bg-transparent text-fg hover:bg-panel2 ring-0',
    class_name
  )}
  {...$$restProps}
>
  <slot />
</button>

