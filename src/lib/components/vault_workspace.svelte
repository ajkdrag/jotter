<script lang="ts">
  import { onMount } from 'svelte'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { create_change_vault_workflow } from '$lib/workflows/create_change_vault_workflow'
  import { create_search_workflow } from '$lib/workflows/create_search_workflow'
  import Button from '$lib/components/ui/button.svelte'
  import CommandPalette from '$lib/components/ui/command_palette.svelte'
  import { note_route } from '$lib/utils/route_utils'

  const change_vault = create_change_vault_workflow()
  const search = create_search_workflow()

  let search_open = $state(false)

  onMount(async () => {
    await change_vault.load_recent()
    await change_vault.open_last_vault()
  })
</script>

<div class="min-h-screen bg-bg text-fg">
  <header class="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3">
        <div class="h-7 w-7 rounded-xl bg-accent/15 ring-1 ring-accent/30"></div>
        <div class="leading-tight">
          <div class="text-sm font-semibold tracking-wide">imdown</div>
          <div class="text-xs text-muted">
            {app_state.vault?.name ?? 'No vault selected'}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button onclick={() => (search_open = true)} variant="ghost">Search</Button>
        <Button onclick={() => void change_vault.choose_and_change()} variant="outline">Change vault</Button>
      </div>
    </div>
  </header>

  <main class="mx-auto grid max-w-6xl grid-cols-[280px,1fr] gap-4 px-4 py-4">
    <aside class="rounded-xl border border-border bg-panel p-3">
      {#if app_state.recent_vaults.length > 0}
        <div class="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Recent vaults</div>
        <div class="mb-3 space-y-1">
          {#each app_state.recent_vaults as v (v.id)}
            <button
              class="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel2"
              onclick={() => void change_vault.open_recent(v.id)}
            >
              <div class="truncate font-semibold">{v.name}</div>
              <div class="truncate text-xs text-muted">{v.path}</div>
            </button>
          {/each}
        </div>
      {/if}

      <div class="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Notes</div>
      <div class="space-y-1">
        {#if app_state.vault == null}
          <div class="text-sm text-muted">Pick a vault to start.</div>
        {:else if app_state.notes.length === 0}
          <div class="text-sm text-muted">No markdown files found.</div>
        {:else}
          {#each app_state.notes as note (note.id)}
            <a
              class="block rounded-lg px-2 py-1.5 text-sm hover:bg-panel2"
              href={note_route(note.path)}
            >
              <div class="truncate">{note.title}</div>
              <div class="truncate text-xs text-muted">{note.path}</div>
            </a>
          {/each}
        {/if}
      </div>
    </aside>

    <section class="rounded-xl border border-border bg-panel p-5">
      <div class="max-w-xl">
        <h1 class="text-xl font-semibold tracking-tight">Local-first Markdown, unapologetically fast</h1>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          Select a vault, open a note, edit in a WYSIWYG Markdown-first editor. Indexing, search, and assets are
          rebuildable.
        </p>
        <div class="mt-5 flex items-center gap-2">
          <Button onclick={() => void change_vault.choose_and_change()}>Choose vault</Button>
          <Button onclick={() => (search_open = true)} variant="outline">Search notes</Button>
        </div>
      </div>
    </section>
  </main>
</div>

<CommandPalette
  open={search_open}
  placeholder="Search notes..."
  onclose={() => (search_open = false)}
  onquery={async (e: CustomEvent<{ query: string }>) => {
    const q = e.detail.query.trim()
    if (!q) {
      app_state.search_results = []
      return
    }
    app_state.search_results = await search.search(q)
  }}
/>
