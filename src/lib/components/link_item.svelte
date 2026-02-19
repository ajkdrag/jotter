<script lang="ts">
  import ArrowDownLeftIcon from "@lucide/svelte/icons/arrow-down-left";
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";

  type Props = {
    title: string;
    path: string;
    meta?: string;
    backlink?: boolean;
    external?: boolean;
    onclick: () => void;
  };

  let {
    title,
    path,
    meta,
    backlink = false,
    external = false,
    onclick,
  }: Props = $props();
</script>

<button type="button" class="LinkItem" {onclick}>
  <span class="LinkItem__icon">
    {#if external}
      <ExternalLinkIcon />
    {:else if backlink}
      <ArrowDownLeftIcon />
    {:else}
      <ArrowUpRightIcon />
    {/if}
  </span>
  <span class="LinkItem__text">
    <span class="LinkItem__titleRow">
      <span class="LinkItem__title">{title}</span>
      {#if meta}
        <span class="LinkItem__meta">{meta}</span>
      {/if}
    </span>
    <span class="LinkItem__path">{path}</span>
  </span>
</button>

<style>
  .LinkItem {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-3);
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .LinkItem:hover {
    background-color: var(--muted);
  }

  .LinkItem__icon {
    flex-shrink: 0;
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  .LinkItem__icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .LinkItem__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
  }

  .LinkItem__title {
    font-size: var(--text-sm);
    color: var(--foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .LinkItem__titleRow {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }

  .LinkItem__meta {
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
  }

  .LinkItem__path {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
