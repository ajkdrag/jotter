<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import type { RenameFolderFlowContext, RenameFolderFlowEvents } from "$lib/flows/rename_folder_flow";
  import type { FlowSnapshot } from "$lib/flows/flow_handle";

  type Props = {
    snapshot: FlowSnapshot<RenameFolderFlowContext>;
    send: (event: RenameFolderFlowEvents) => void;
  };

  let { snapshot, send }: Props = $props();

  const is_confirming = $derived(snapshot.matches("confirming"));
  const is_renaming = $derived(snapshot.matches("renaming"));
  const is_error = $derived(snapshot.matches("error"));
  const is_open = $derived(is_confirming || is_renaming || is_error);

  let input_ref: HTMLInputElement | undefined = $state();
  let new_path_value = $state("");

  $effect(() => {
    if (is_confirming && snapshot.context.new_path) {
      new_path_value = snapshot.context.new_path;
    }
  });

  function handle_input(e: Event) {
    const target = e.target as HTMLInputElement;
    new_path_value = target.value;
    send({ type: "UPDATE_NEW_PATH", path: target.value });
  }

  function handle_confirm() {
    send({ type: "CONFIRM" });
  }

  function handle_cancel() {
    send({ type: "CANCEL" });
  }

  function handle_retry() {
    send({ type: "RETRY" });
  }

  function handle_open_change(open: boolean) {
    if (!open && (is_confirming || is_error)) {
      send({ type: "CANCEL" });
    }
  }

  function handle_open_auto_focus(e: Event) {
    e.preventDefault();
    if (input_ref) {
      const parts = new_path_value.split("/");
      const folder_name = parts[parts.length - 1] || "";
      const parent = parts.slice(0, -1).join("/");
      const start_pos = parent ? parent.length + 1 : 0;

      const ref = input_ref
      setTimeout(() => {
        ref.focus();
        ref.setSelectionRange(start_pos, start_pos + folder_name.length);
      }, 0);
    }
  }
</script>

<Dialog.Root open={is_open} onOpenChange={handle_open_change}>
  <Dialog.Content class="max-w-md" onOpenAutoFocus={handle_open_auto_focus}>
    <Dialog.Header>
      <Dialog.Title>{is_error ? "Rename Failed" : "Rename Folder"}</Dialog.Title>
      <Dialog.Description>
        {#if is_error}
          {snapshot.context.error || "An unknown error occurred"}
        {:else}
          Enter a new path for the folder
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    {#if !is_error}
      <div class="grid gap-4 py-4">
        <input
          bind:this={input_ref}
          type="text"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={new_path_value}
          oninput={handle_input}
          disabled={is_renaming}
          placeholder="folder/path"
        />
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={handle_cancel} disabled={is_renaming}>
        Cancel
      </Button>
      {#if is_error}
        <Button onclick={handle_retry}>
          Retry
        </Button>
      {:else}
        <Button onclick={handle_confirm} disabled={is_renaming}>
          {is_renaming ? "Renaming..." : "Rename"}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
