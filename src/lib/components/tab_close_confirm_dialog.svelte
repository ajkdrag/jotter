<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";

  interface Props {
    open: boolean;
    tab_title: string;
    on_save: () => void;
    on_discard: () => void;
    on_cancel: () => void;
  }

  let { open, tab_title, on_save, on_discard, on_cancel }: Props = $props();

  const display_name = $derived(tab_title ? `"${tab_title}"` : "this tab");
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value) on_cancel();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Unsaved Changes</Dialog.Title>
      <Dialog.Description>
        {display_name} has unsaved changes. Do you want to save before closing?
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel}>Cancel</Button>
      <Button variant="destructive" onclick={on_discard}>Don't Save</Button>
      <Button onclick={on_save}>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
