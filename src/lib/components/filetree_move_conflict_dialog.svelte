<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";

  type ConflictItem = {
    path: string;
    new_path: string;
    error: string;
  };

  type Props = {
    open: boolean;
    target_folder: string;
    conflicts: ConflictItem[];
    on_overwrite: () => void;
    on_skip: () => void;
    on_cancel: () => void;
  };

  let {
    open,
    target_folder,
    conflicts,
    on_overwrite,
    on_skip,
    on_cancel,
  }: Props = $props();

  const destination_label = $derived(target_folder || "vault root");
</script>

<Dialog.Root
  {open}
  onOpenChange={(value) => {
    if (!value) {
      on_cancel();
    }
  }}
>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>Move Conflicts Detected</Dialog.Title>
      <Dialog.Description>
        {conflicts.length} item(s) already exist in {destination_label}.
      </Dialog.Description>
    </Dialog.Header>
    <div class="max-h-64 overflow-y-auto rounded-md border border-border p-2">
      {#each conflicts as conflict (conflict.path)}
        <div class="mb-2 rounded-md bg-muted/50 p-2 last:mb-0">
          <div class="truncate text-sm font-medium">{conflict.path}</div>
          <div class="truncate text-xs text-muted-foreground">
            -> {conflict.new_path}
          </div>
        </div>
      {/each}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel}>Cancel</Button>
      <Button variant="secondary" onclick={on_skip}>Skip Conflicts</Button>
      <Button variant="destructive" onclick={on_overwrite}>
        Overwrite All
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
