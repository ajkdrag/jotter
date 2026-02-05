<script lang="ts">
  import type { Snippet } from "svelte";
  import "../app.css";
  import "../styles/design_tokens.css";
  import "../styles/component_overrides.css";
  import "../styles/editor.css";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";
  import { toast } from "svelte-sonner";
  import { logger } from "$lib/utils/logger";
  import { error_message } from "$lib/utils/error_message";
  import { onMount } from "svelte";

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    const on_error = (event: ErrorEvent) => {
      event.preventDefault();
      logger.from_error("Unhandled error", event.error);
      toast.error("Something went wrong");
    };

    const on_rejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      logger.error(`Unhandled rejection: ${error_message(event.reason)}`);
      toast.error("Something went wrong");
    };

    window.addEventListener("error", on_error);
    window.addEventListener("unhandledrejection", on_rejection);

    return () => {
      window.removeEventListener("error", on_error);
      window.removeEventListener("unhandledrejection", on_rejection);
    };
  });
</script>

<main class="h-full">
  <ModeWatcher />
  <Toaster
    position="bottom-right"
    offset={36}
    style="
      --normal-bg: var(--color-popover);
      --normal-text: var(--color-popover-foreground);
      --normal-border: var(--color-border);
      --success-bg: var(--interactive-bg);
      --success-text: var(--interactive-text-on-bg);
      --success-border: var(--interactive-border-subtle);
      --error-bg: var(--color-popover);
      --error-text: var(--color-popover-foreground);
      --error-border: var(--color-destructive);
    "
  />
  {@render children()}
</main>
