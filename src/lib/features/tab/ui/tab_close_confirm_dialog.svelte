<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";

  interface Props {
    open: boolean;
    tab_title: string;
    remaining_count: number;
    apply_to_all: boolean;
    on_save: () => void;
    on_discard: () => void;
    on_cancel: () => void;
    on_toggle_apply_to_all: (checked: boolean) => void;
  }

  let {
    open,
    tab_title,
    remaining_count,
    apply_to_all,
    on_save,
    on_discard,
    on_cancel,
    on_toggle_apply_to_all,
  }: Props = $props();

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
    {#if remaining_count > 0}
      <label class="TabCloseConfirmDialog__apply-all">
        <input
          type="checkbox"
          checked={apply_to_all}
          onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
            on_toggle_apply_to_all(e.currentTarget.checked);
          }}
        />
        <span
          >Apply to remaining {remaining_count} tab{remaining_count > 1
            ? "s"
            : ""}</span
        >
      </label>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel}>Cancel</Button>
      <Button variant="destructive" onclick={on_discard}>Don't Save</Button>
      <Button onclick={on_save}>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .TabCloseConfirmDialog__apply-all {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--muted-foreground);
    cursor: pointer;
    padding: var(--space-1) 0;
    user-select: none;
  }

  .TabCloseConfirmDialog__apply-all input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    accent-color: var(--primary);
    cursor: pointer;
  }
</style>
