<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import type { DeleteFolderFlowContext, DeleteFolderFlowEvents } from "$lib/flows/delete_folder_flow";
  import type { FlowSnapshot } from "$lib/flows/flow_handle";

  type Props = {
    snapshot: FlowSnapshot<DeleteFolderFlowContext>;
    send: (event: DeleteFolderFlowEvents) => void;
  };

  let { snapshot, send }: Props = $props();

  const is_fetching_stats = $derived(snapshot.matches("fetching_stats"));
  const is_confirming = $derived(snapshot.matches("confirming"));
  const is_deleting = $derived(snapshot.matches("deleting"));
  const is_error = $derived(snapshot.matches("error"));
  const is_open = $derived(is_fetching_stats || is_confirming || is_deleting || is_error);
  const is_loading = $derived(is_fetching_stats || is_deleting);

  const folder_name = $derived.by(() => {
    const path = snapshot.context.folder_path;
    if (!path) return "";
    const parts = path.split("/");
    return parts[parts.length - 1] || "";
  });

  const affected_note_count = $derived(snapshot.context.affected_note_count);
  const affected_folder_count = $derived(snapshot.context.affected_folder_count);

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
</script>

<Dialog.Root open={is_open} onOpenChange={handle_open_change}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{is_error ? "Delete Failed" : "Delete Folder"}</Dialog.Title>
      <Dialog.Description>
        {#if is_error}
          {snapshot.context.error || "An unknown error occurred"}
        {:else if is_fetching_stats}
          Checking contents of <span class="font-medium">{folder_name}</span>...
        {:else}
          Are you sure you want to delete the folder <span class="font-medium">{folder_name}</span>?
          {#if affected_note_count > 0 || affected_folder_count > 0}
            <br /><br />
            This will permanently delete:
            <ul class="mt-2 list-disc pl-5">
              {#if affected_note_count > 0}
                <li>{affected_note_count} note{affected_note_count === 1 ? "" : "s"}</li>
              {/if}
              {#if affected_folder_count > 0}
                <li>{affected_folder_count} subfolder{affected_folder_count === 1 ? "" : "s"}</li>
              {/if}
            </ul>
          {/if}
          <br />
          This action cannot be undone.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={handle_cancel} disabled={is_loading}>
        Cancel
      </Button>
      {#if is_error}
        <Button variant="destructive" onclick={handle_retry}>
          Retry
        </Button>
      {:else}
        <Button variant="destructive" onclick={handle_confirm} disabled={is_loading}>
          {#if is_fetching_stats}
            Loading...
          {:else if is_deleting}
            Deleting...
          {:else}
            Delete
          {/if}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
