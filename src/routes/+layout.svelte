<script lang="ts">
  import "../app.css";
  import "../styles/design_tokens.css";
  import "../styles/editor.css";
  import { ModeWatcher } from "mode-watcher";

  let { children } = $props();
</script>

<main class="h-full">
  <ModeWatcher />
  {@render children()}
</main>
