<script lang="ts">
  import "../app.css";
  import "../styles/editor.css";

  let { children } = $props();
</script>

<main class="h-full">
  {@render children()}
</main>
