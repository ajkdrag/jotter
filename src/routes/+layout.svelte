<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<main class="h-full">
  {@render children()}
</main>
