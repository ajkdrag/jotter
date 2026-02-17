<script lang="ts">
  import LinkSection from "$lib/components/link_section.svelte";
  import LinkItem from "$lib/components/link_item.svelte";
  import { use_app_context } from "$lib/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/actions/action_ids";
  import { extract_external_links } from "$lib/domain/extract_links";

  const { stores, action_registry } = use_app_context();

  const backlinks = $derived(stores.links.backlinks);
  const outlinks = $derived(stores.links.outlinks);
  const orphan_links = $derived(stores.links.orphan_links);

  const external_links = $derived.by(() => {
    const markdown = stores.editor.open_note?.markdown;
    if (!markdown) return [];
    return extract_external_links(markdown);
  });

  function open_existing_note(path: string) {
    void action_registry.execute(ACTION_IDS.note_open, path);
  }

  function open_or_create_note(path: string) {
    void action_registry.execute(ACTION_IDS.note_open_wiki_link, path);
  }

  function open_url(url: string) {
    void action_registry.execute(ACTION_IDS.shell_open_url, url);
  }

  function title_from_path(path: string): string {
    const leaf = path.split("/").pop() ?? path;
    return leaf.endsWith(".md") ? leaf.slice(0, -3) : leaf;
  }
</script>

<div class="LinksPanel">
  <LinkSection title="Backlinks" count={backlinks.length}>
    {#if backlinks.length === 0}
      <p class="LinksPanel__empty">No backlinks</p>
    {:else}
      {#each backlinks as link (link.path)}
        <LinkItem
          title={link.title}
          path={link.path}
          onclick={() => open_existing_note(link.path)}
        />
      {/each}
    {/if}
  </LinkSection>

  <LinkSection title="Outlinks" count={outlinks.length}>
    {#if outlinks.length === 0}
      <p class="LinksPanel__empty">No outlinks</p>
    {:else}
      {#each outlinks as link (link.path)}
        <LinkItem
          title={link.title}
          path={link.path}
          onclick={() => open_existing_note(link.path)}
        />
      {/each}
    {/if}
  </LinkSection>

  <LinkSection
    title="Orphan links"
    count={orphan_links.length}
    default_expanded={false}
  >
    {#if orphan_links.length === 0}
      <p class="LinksPanel__empty">No orphan links</p>
    {:else}
      {#each orphan_links as path (path)}
        <LinkItem
          title={title_from_path(path)}
          {path}
          onclick={() => open_or_create_note(path)}
        />
      {/each}
    {/if}
  </LinkSection>

  <LinkSection
    title="External"
    count={external_links.length}
    default_expanded={false}
  >
    {#if external_links.length === 0}
      <p class="LinksPanel__empty">No external links</p>
    {:else}
      {#each external_links as link (link.url)}
        <LinkItem
          title={link.text}
          path={link.url}
          external
          onclick={() => open_url(link.url)}
        />
      {/each}
    {/if}
  </LinkSection>
</div>

<style>
  .LinksPanel {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    height: 100%;
  }

  .LinksPanel__empty {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-6);
    margin: 0;
  }
</style>
