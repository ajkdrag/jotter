<script lang="ts">
  import { Files, Settings } from '@lucide/svelte'
  import { Button } from '$lib/components/ui/button'

  type Props = {
    sidebar_open: boolean
    on_toggle_sidebar: () => void
    on_open_settings: () => void
  }

  let { sidebar_open, on_toggle_sidebar, on_open_settings }: Props = $props()
</script>

<div
  class="sticky top-0 z-30 flex h-svh w-12 flex-col items-center justify-between border-r border-sidebar-border bg-sidebar py-1"
>
  <div class="flex flex-col">
    <Button
      variant="ghost"
      size="icon"
      onclick={on_toggle_sidebar}
      class="relative size-12 rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground before:absolute before:inset-y-3 before:start-0 before:w-0.5 before:bg-sidebar-primary before:opacity-0 data-[active=true]:before:opacity-100"
      data-active={sidebar_open}
      aria-pressed={sidebar_open}
      aria-label="Toggle Explorer"
    >
      <Files class="h-5 w-5" />
    </Button>
  </div>

  <div class="flex flex-col">
    <Button
      variant="ghost"
      size="icon"
      onclick={on_open_settings}
      class="size-12 rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
      aria-label="Settings"
    >
      <Settings class="h-5 w-5" />
    </Button>
  </div>
</div>
