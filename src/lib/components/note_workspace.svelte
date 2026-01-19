<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { app_state } from '$lib/adapters/state/app_state.svelte'
  import { create_open_note_workflow } from '$lib/workflows/create_open_note_workflow'
  import { create_autosave_workflow } from '$lib/workflows/create_autosave_workflow'
  import { create_drop_image_workflow } from '$lib/workflows/create_drop_image_workflow'
  import Button from '$lib/components/ui/button.svelte'
  import NoteEditor from '$lib/components/note_editor.svelte'
  import { note_route } from '$lib/utils/route_utils'
  import { DialogRoot, DialogPortal, DialogOverlay, DialogContent } from '$lib/components/ui/dialog'
  import { create_conflict_workflow } from '$lib/workflows/create_conflict_workflow'
  import { create_wiki_link_workflow } from '$lib/workflows/create_wiki_link_workflow'
  import { parse_wiki_links, resolve_wiki_link } from '$lib/utils/wiki_links'
  import type { MilkdownHandle } from '$lib/adapters/editor/milkdown_adapter'

  type Props = {
    note_path: string | undefined
  }

  let { note_path }: Props = $props()

  const open_note = create_open_note_workflow()
  const autosave = create_autosave_workflow()
  const drop_image = create_drop_image_workflow()
  const conflict = create_conflict_workflow()
  const wiki = create_wiki_link_workflow()
  let conflict_open = $state(false)

  let missing_wiki = $derived.by(() => {
    const open = app_state.open_note
    if (!open) return []
    const tokens = parse_wiki_links(String(open.markdown))
    const unique = Array.from(new Set(tokens))
    return unique
      .map((t) => ({ token: t, resolved: resolve_wiki_link(app_state.notes, t) }))
      .filter((x) => x.resolved == null)
  })

  onMount(async () => {
    if (!app_state.vault) {
      await goto('/')
      return
    }
    if (!note_path) {
      await goto('/vault')
      return
    }
    await open_note.open(note_path)

    const on_keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void autosave.flush()
      }
    }

    const on_blur = () => void autosave.flush()
    const on_visibility = () => {
      if (document.visibilityState === 'hidden') void autosave.flush()
    }
    const on_before_unload = () => void autosave.flush()

    window.addEventListener('keydown', on_keydown)
    window.addEventListener('blur', on_blur)
    document.addEventListener('visibilitychange', on_visibility)
    window.addEventListener('beforeunload', on_before_unload)

    onDestroy(() => {
      window.removeEventListener('keydown', on_keydown)
      window.removeEventListener('blur', on_blur)
      document.removeEventListener('visibilitychange', on_visibility)
      window.removeEventListener('beforeunload', on_before_unload)
      void drop_image.destroy()
    })
  })

  $effect(() => {
    conflict_open = app_state.conflict != null
  })
</script>

<div class="min-h-screen bg-bg text-fg">
  <header class="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3">
        <a class="text-xs text-muted hover:text-fg" href="/vault">← Vault</a>
        <div class="leading-tight">
          <div class="text-sm font-semibold tracking-wide">{app_state.open_note?.meta.title ?? 'Note'}</div>
          <div class="text-xs text-muted">{app_state.open_note?.meta.path ?? ''}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button onclick={() => void autosave.flush()} variant="outline">Save</Button>
      </div>
    </div>
  </header>

  <main class="mx-auto grid max-w-6xl grid-cols-[1fr,280px] gap-4 px-4 py-4">
    <section class="rounded-xl border border-border bg-panel p-3">
      {#if app_state.open_note && app_state.vault}
        <NoteEditor
          note={app_state.open_note}
          vault_id={app_state.vault.id}
          onchange={(e: CustomEvent<{ markdown: string }>) => autosave.on_edit(e.detail.markdown)}
          onready={(e: CustomEvent<MilkdownHandle>) => drop_image.bind_to_editor(e.detail)}
        />
      {:else}
        <div class="p-6 text-sm text-muted">Loading…</div>
      {/if}
    </section>

    <aside class="rounded-xl border border-border bg-panel p-3">
      <div class="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Links</div>
      {#if app_state.links.loading}
        <div class="text-sm text-muted">Computing links…</div>
      {:else}
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Backlinks</div>
            {#if app_state.links.backlinks.length === 0}
              <div class="text-muted">None.</div>
            {:else}
              {#each app_state.links.backlinks as n (n.id)}
                <a class="block rounded-lg px-2 py-1.5 hover:bg-panel2" href={note_route(n.path)}>
                  <div class="truncate">{n.title}</div>
                  <div class="truncate text-xs text-muted">{n.path}</div>
                </a>
              {/each}
            {/if}
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Outlinks</div>
            {#if app_state.links.outlinks.length === 0}
              <div class="text-muted">None.</div>
            {:else}
              {#each app_state.links.outlinks as n (n.id)}
                <a class="block rounded-lg px-2 py-1.5 hover:bg-panel2" href={note_route(n.path)}>
                  <div class="truncate">{n.title}</div>
                  <div class="truncate text-xs text-muted">{n.path}</div>
                </a>
              {/each}
            {/if}
          </div>
          {#if missing_wiki.length > 0}
            <div>
              <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Missing wiki links</div>
              <div class="space-y-1">
                {#each missing_wiki as m (m.token)}
                  <div class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-panel2">
                    <div class="min-w-0">
                      <div class="truncate">{m.token}</div>
                      <div class="truncate text-xs text-muted">[[{m.token}]]</div>
                    </div>
                    <Button
                      variant="outline"
                      class_name="h-8 px-2 py-0"
                      onclick={async () => {
                        const meta = await wiki.create_from_token(m.token)
                        await goto(note_route(meta.path))
                      }}
                    >
                      Create
                    </Button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </aside>
  </main>
</div>

<DialogRoot
  bind:open={conflict_open}
  onOpenChange={(open: boolean) => {
    if (!open) app_state.conflict = null
  }}
>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 bg-black/55 backdrop-blur-sm" />
    <DialogContent
      class="fixed left-1/2 top-[18%] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-border bg-panel p-4 shadow-2xl"
    >
      <div class="text-sm font-semibold">External change detected</div>
      <div class="mt-2 text-sm text-muted">
        This note changed on disk while you were editing: <span class="text-fg">{app_state.conflict?.note_path}</span>
      </div>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onclick={async () => {
            await conflict.reload_from_disk()
          }}
        >
          Reload from disk
        </Button>
        <Button
          onclick={async () => {
            await conflict.keep_mine_with_backup()
          }}
        >
          Keep mine (backup theirs)
        </Button>
      </div>
    </DialogContent>
  </DialogPortal>
</DialogRoot>
