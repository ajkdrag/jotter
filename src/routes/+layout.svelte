<script lang="ts">
  import type { Snippet } from "svelte";
  import "../app.css";
  import "../styles/design_tokens.css";
  import "../styles/editor.css";
  import { ModeWatcher } from "mode-watcher";

  let { children }: { children: Snippet } = $props();
</script>

<main class="h-full">
  <ModeWatcher />
  {@render children()}
</main>
