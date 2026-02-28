<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  interface Props {
    open: boolean;
    description: string;
    is_loading: boolean;
    on_update_description: (value: string) => void;
    on_confirm: () => void;
    on_cancel: () => void;
  }

  let {
    open,
    description,
    is_loading,
    on_update_description,
    on_confirm,
    on_cancel,
  }: Props = $props();

  function handle_keydown(e: KeyboardEvent) {
    if (e.key === "Enter" && description.trim() && !is_loading) {
      e.preventDefault();
      on_confirm();
    }
  }
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value && !is_loading) on_cancel();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Create Checkpoint</Dialog.Title>
      <Dialog.Description>
        Save a snapshot of the current state with a description.
      </Dialog.Description>
    </Dialog.Header>

    <div class="CheckpointDialog__field">
      <Input
        placeholder="What changed?"
        value={description}
        oninput={(e: Event) => {
          on_update_description((e.target as HTMLInputElement).value);
        }}
        onkeydown={handle_keydown}
        disabled={is_loading}
        autofocus
      />
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_loading}>
        Cancel
      </Button>
      <Button onclick={on_confirm} disabled={is_loading || !description.trim()}>
        {#if is_loading}
          Creating...
        {:else}
          Create Checkpoint
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .CheckpointDialog__field {
    padding-block: var(--space-2);
  }
</style>
