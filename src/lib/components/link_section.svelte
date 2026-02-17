<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    count: number;
    children: Snippet;
    default_expanded?: boolean;
  };

  let { title, count, children, default_expanded = true }: Props = $props();

  let expanded = $state(true);

  $effect(() => {
    expanded = default_expanded;
  });
</script>

<div class="LinkSection">
  <button
    type="button"
    class="LinkSection__header"
    onclick={() => (expanded = !expanded)}
  >
    <span
      class="LinkSection__chevron"
      class:LinkSection__chevron--expanded={expanded}
    >
      <ChevronRightIcon />
    </span>
    <span class="LinkSection__label">{title}</span>
    <span class="LinkSection__count">{count}</span>
  </button>
  {#if expanded}
    <div class="LinkSection__content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .LinkSection {
    display: flex;
    flex-direction: column;
  }

  .LinkSection__header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: none;
    background: none;
    cursor: pointer;
    user-select: none;
  }

  .LinkSection__chevron {
    flex-shrink: 0;
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
    color: var(--muted-foreground);
    transition: transform var(--duration-fast) var(--ease-default);
    transform: rotate(0deg);
  }

  .LinkSection__chevron--expanded {
    transform: rotate(90deg);
  }

  .LinkSection__chevron :global(svg) {
    width: 100%;
    height: 100%;
  }

  .LinkSection__label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .LinkSection__count {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    margin-left: auto;
  }

  .LinkSection__content {
    display: flex;
    flex-direction: column;
    padding-bottom: var(--space-2);
  }
</style>
