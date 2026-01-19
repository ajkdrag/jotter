<script lang="ts">
  import { cn } from '$lib/components/ui/cn'
  export let class_name: string = ''
</script>

<input
  class={cn(
    'h-10 w-full rounded-xl bg-bg px-3 text-sm text-fg ring-1 ring-inset ring-border focus:outline-none focus:ring-2 focus:ring-accent/60',
    class_name
  )}
  {...$$restProps}
/>

