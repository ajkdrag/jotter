<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";

  type DeleteFolderDialogState =
    | "idle"
    | "fetching_stats"
    | "confirming"
    | "deleting"
    | "error";

  type Props = {
    open: boolean;
    folder_path: string | null;
    affected_note_count: number;
    affected_folder_count: number;
    status: string;
    error: string | null;
    on_confirm: () => void;
    on_cancel: () => void;
    on_retry: () => void;
  };

  let {
    open,
    folder_path,
    affected_note_count,
    affected_folder_count,
    status,
    error,
    on_confirm,
    on_cancel,
    on_retry,
  }: Props = $props();

  const normalized_state = $derived(
    (status as DeleteFolderDialogState) ?? "idle",
  );
  const is_fetching_stats = $derived(normalized_state === "fetching_stats");
  const is_confirming = $derived(normalized_state === "confirming");
  const is_deleting = $derived(normalized_state === "deleting");
  const is_error = $derived(normalized_state === "error");
  const is_loading = $derived(is_fetching_stats || is_deleting);

  const folder_name = $derived.by(() => {
    if (!folder_path) return "";
    const parts = folder_path.split("/");
    return parts[parts.length - 1] || "";
  });

  function handle_open_change(next_open: boolean) {
    if (!next_open && (is_confirming || is_error)) {
      on_cancel();
    }
  }
</script>

<Dialog.Root {open} onOpenChange={handle_open_change}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{is_error ? "Delete Failed" : "Delete Folder"}</Dialog.Title
      >
      <Dialog.Description>
        {#if is_error}
          {error || "An unknown error occurred"}
        {:else if is_fetching_stats}
          Checking contents of <span class="font-medium">{folder_name}</span>...
        {:else}
          Are you sure you want to delete the folder <span class="font-medium"
            >{folder_name}</span
          >?
          {#if affected_note_count > 0 || affected_folder_count > 0}
            <br /><br />
            This will permanently delete:
            <ul class="mt-2 list-disc pl-5">
              {#if affected_note_count > 0}
                <li>
                  {affected_note_count} note{affected_note_count === 1
                    ? ""
                    : "s"}
                </li>
              {/if}
              {#if affected_folder_count > 0}
                <li>
                  {affected_folder_count} subfolder{affected_folder_count === 1
                    ? ""
                    : "s"}
                </li>
              {/if}
            </ul>
          {/if}
          <br />
          This action cannot be undone.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_loading}>
        Cancel
      </Button>
      {#if is_error}
        <Button variant="destructive" onclick={on_retry}>Retry</Button>
      {:else}
        <Button
          variant="destructive"
          onclick={on_confirm}
          disabled={is_loading}
        >
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
