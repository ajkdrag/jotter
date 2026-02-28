<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import type { NoteMeta } from "$lib/shared/types/note";
  import { parent_folder_path } from "$lib/shared/utils/path";
  import { tick } from "svelte";

  interface Props {
    open: boolean;
    note: NoteMeta | null;
    new_name: string;
    is_renaming: boolean;
    is_checking_conflict: boolean;
    error: string | null;
    show_overwrite_confirm: boolean;
    on_update_name: (name: string) => void;
    on_confirm: () => void;
    on_confirm_overwrite: () => void;
    on_cancel: () => void;
    on_retry: () => void;
  }

  let {
    open,
    note,
    new_name,
    is_renaming,
    is_checking_conflict,
    error,
    show_overwrite_confirm,
    on_update_name,
    on_confirm,
    on_confirm_overwrite,
    on_cancel,
    on_retry,
  }: Props = $props();

  let input_el = $state<HTMLInputElement | null>(null);

  const parent_path = $derived.by(() => {
    if (!note) return "";
    return parent_folder_path(note.path);
  });

  const current_name = $derived.by(() => {
    if (!note) return "";
    const filename = note.path.split("/").pop() ?? "";
    return filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  });

  const is_busy = $derived(is_renaming || is_checking_conflict);

  function is_input_valid(): boolean {
    const trimmed = new_name.trim();
    return (
      trimmed.length > 0 && !trimmed.includes("/") && trimmed !== current_name
    );
  }

  function get_display_title() {
    if (error) return "Rename Failed";
    if (show_overwrite_confirm) return "File Already Exists";
    return "Rename Note";
  }

  function get_display_description() {
    if (error) {
      return `Failed to rename ${note?.title ?? "this note"}: ${error}`;
    }
    if (show_overwrite_confirm) {
      return `A note named "${new_name.trim()}" already exists in this folder. Do you want to overwrite it?`;
    }
    return `Enter a new name for ${note?.title ?? "this note"}.`;
  }

  $effect(() => {
    if (open && !error && !show_overwrite_confirm && input_el) {
      const el = input_el;
      void tick().then(() => {
        el.focus();
        el.select();
      });
    }
  });
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value) on_cancel();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{get_display_title()}</Dialog.Title>
      <Dialog.Description>
        {get_display_description()}
      </Dialog.Description>
    </Dialog.Header>

    {#if !error && !show_overwrite_confirm}
      <div class="space-y-3 overflow-hidden">
        {#if parent_path}
          <div class="flex items-center gap-2 text-sm min-w-0">
            <span class="shrink-0 text-muted-foreground">Location:</span>
            <span
              class="truncate font-mono text-muted-foreground"
              title={parent_path}>{parent_path}/</span
            >
          </div>
        {/if}
        <Input
          bind:ref={input_el}
          type="text"
          value={new_name}
          onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
            on_update_name(e.currentTarget.value);
          }}
          oninput={(e: Event & { currentTarget: HTMLInputElement }) => {
            on_update_name(e.currentTarget.value);
          }}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter" && is_input_valid() && !is_busy) {
              e.preventDefault();
              on_confirm();
            }
          }}
          placeholder="new-title"
          disabled={is_busy}
        />
      </div>
    {/if}

    <Dialog.Footer>
      {#if show_overwrite_confirm}
        <Button variant="outline" onclick={on_cancel} disabled={is_renaming}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onclick={on_confirm_overwrite}
          disabled={is_renaming}
        >
          {is_renaming ? "Renaming..." : "Overwrite"}
        </Button>
      {:else if error}
        <Button variant="outline" onclick={on_cancel}>Cancel</Button>
        <Button variant="default" onclick={on_retry}>Retry</Button>
      {:else}
        <Button variant="outline" onclick={on_cancel} disabled={is_busy}>
          Cancel
        </Button>
        <Button
          variant="default"
          onclick={on_confirm}
          disabled={!is_input_valid() || is_busy}
        >
          {is_busy ? "Renaming..." : "Rename"}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
