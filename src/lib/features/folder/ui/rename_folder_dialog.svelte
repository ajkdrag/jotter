<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { parent_folder_path } from "$lib/shared/utils/path";
  import { tick } from "svelte";

  type RenameFolderDialogState = "idle" | "confirming" | "renaming" | "error";

  type Props = {
    open: boolean;
    folder_path: string | null;
    new_name: string;
    status: string;
    error: string | null;
    on_update_name: (name: string) => void;
    on_confirm: () => void;
    on_cancel: () => void;
    on_retry: () => void;
  };

  let {
    open,
    folder_path,
    new_name,
    status,
    error,
    on_update_name,
    on_confirm,
    on_cancel,
    on_retry,
  }: Props = $props();

  let input_el = $state<HTMLInputElement | null>(null);

  const normalized_state = $derived(
    (status as RenameFolderDialogState) ?? "idle",
  );
  const is_confirming = $derived(normalized_state === "confirming");
  const is_renaming = $derived(normalized_state === "renaming");
  const is_error = $derived(normalized_state === "error");

  const parent_path = $derived.by(() => {
    if (!folder_path) return "";
    return parent_folder_path(folder_path);
  });

  const current_name = $derived.by(() => {
    if (!folder_path) return "";
    const i = folder_path.lastIndexOf("/");
    return i >= 0 ? folder_path.slice(i + 1) : folder_path;
  });

  function is_input_valid(): boolean {
    const trimmed = new_name.trim();
    return (
      trimmed.length > 0 &&
      !trimmed.includes("/") &&
      trimmed !== "." &&
      trimmed !== ".." &&
      trimmed !== current_name
    );
  }

  function handle_input(event: Event & { currentTarget: HTMLInputElement }) {
    on_update_name(event.currentTarget.value);
  }

  function handle_open_change(next_open: boolean) {
    if (!next_open && (is_confirming || is_error)) {
      on_cancel();
    }
  }

  $effect(() => {
    if (open && !is_error && input_el) {
      const el = input_el;
      void tick().then(() => {
        el.focus();
        el.select();
      });
    }
  });
</script>

<Dialog.Root {open} onOpenChange={handle_open_change}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{is_error ? "Rename Failed" : "Rename Folder"}</Dialog.Title
      >
      <Dialog.Description>
        {#if is_error}
          {error || "An unknown error occurred"}
        {:else}
          Enter a new name for the folder.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    {#if !is_error}
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
          oninput={handle_input}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter" && is_input_valid() && !is_renaming) {
              e.preventDefault();
              on_confirm();
            }
          }}
          disabled={is_renaming}
          placeholder="folder-name"
        />
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_renaming}>
        Cancel
      </Button>
      {#if is_error}
        <Button onclick={on_retry}>Retry</Button>
      {:else}
        <Button
          onclick={on_confirm}
          disabled={!is_input_valid() || is_renaming}
        >
          {is_renaming ? "Renaming..." : "Rename"}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
