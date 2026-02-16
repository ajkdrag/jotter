<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";
  import HotkeyKey from "$lib/components/hotkey_key.svelte";
  import {
    normalize_event_to_key,
    is_valid_hotkey,
    is_reserved_key,
  } from "$lib/domain/hotkey_validation";
  import type {
    HotkeyConflict,
    HotkeyKey as HotkeyKeyType,
  } from "$lib/types/hotkey_config";

  type Props = {
    open: boolean;
    action_id: string | null;
    current_key: HotkeyKeyType | null;
    pending_key: HotkeyKeyType | null;
    conflict: HotkeyConflict | null;
    error: string | null;
    on_record: (key: string) => void;
    on_save: () => void;
    on_cancel: () => void;
  };

  let {
    open,
    action_id,
    current_key,
    pending_key,
    conflict,
    error,
    on_record,
    on_save,
    on_cancel,
  }: Props = $props();

  let is_recording = $state(false);
  let local_error = $state<string | null>(null);

  const display_key = $derived(pending_key ?? current_key);
  const has_change = $derived(
    pending_key !== null && pending_key !== current_key,
  );
  const effective_error = $derived(error ?? local_error);

  function handle_keydown(event: KeyboardEvent) {
    if (!is_recording) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      is_recording = false;
      local_error = null;
      return;
    }

    const modifier_only = new Set([
      "Control",
      "Meta",
      "Alt",
      "Shift",
      "CapsLock",
    ]);
    if (modifier_only.has(event.key)) return;

    const key = normalize_event_to_key(event);

    const validation = is_valid_hotkey(key);
    if (!validation.valid) {
      local_error = validation.error ?? "Invalid hotkey";
      return;
    }

    if (is_reserved_key(key)) {
      local_error = "This key is reserved by the system";
      return;
    }

    local_error = null;
    is_recording = false;
    on_record(key);
  }

  function start_recording() {
    is_recording = true;
    local_error = null;
  }

  function handle_open_change(v: boolean) {
    if (!v) {
      is_recording = false;
      local_error = null;
      on_cancel();
    }
  }
</script>

<Dialog.Root {open} onOpenChange={handle_open_change}>
  <Dialog.Content class="HotkeyRecorder">
    <Dialog.Header>
      <Dialog.Title>Edit Hotkey</Dialog.Title>
      <Dialog.Description>
        Press a key combination to set the hotkey, or click "Record" to start
        listening.
      </Dialog.Description>
    </Dialog.Header>

    <div class="HotkeyRecorder__body">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="HotkeyRecorder__capture"
        class:HotkeyRecorder__capture--recording={is_recording}
        class:HotkeyRecorder__capture--error={effective_error !== null}
        role="textbox"
        aria-label="Hotkey capture area"
        tabindex={0}
        onkeydown={handle_keydown}
        onfocus={() => {
          if (!is_recording) start_recording();
        }}
      >
        {#if is_recording}
          <span class="HotkeyRecorder__recording-label">
            Press a key combination...
          </span>
        {:else if display_key}
          <HotkeyKey hotkey={display_key} />
        {:else}
          <span class="HotkeyRecorder__empty">Not bound</span>
        {/if}
      </div>

      {#if effective_error}
        <p class="HotkeyRecorder__error">{effective_error}</p>
      {/if}

      {#if conflict}
        <div class="HotkeyRecorder__conflict">
          <p class="HotkeyRecorder__conflict-text">
            This key is already assigned to
            <strong>{conflict.existing_label}</strong>. Saving will unbind it
            from that action.
          </p>
        </div>
      {/if}

      {#if !is_recording}
        <Button
          variant="outline"
          size="sm"
          class="transition-colors"
          onclick={start_recording}
        >
          Record New Key
        </Button>
      {/if}
    </div>

    <Dialog.Footer class="HotkeyRecorder__footer">
      <Button variant="outline" class="transition-colors" onclick={on_cancel}>
        Cancel
      </Button>
      <Button
        class="transition-colors"
        disabled={!has_change || effective_error !== null}
        onclick={on_save}
      >
        Save
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.HotkeyRecorder) {
    max-width: 28rem;
  }

  .HotkeyRecorder__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) 0;
  }

  .HotkeyRecorder__capture {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 4rem;
    border: 2px dashed var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    cursor: pointer;
    transition:
      border-color var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default);
  }

  .HotkeyRecorder__capture:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .HotkeyRecorder__capture--recording {
    border-color: var(--interactive);
    background-color: var(--interactive-bg);
  }

  .HotkeyRecorder__capture--error {
    border-color: var(--destructive);
  }

  .HotkeyRecorder__recording-label {
    font-size: var(--text-sm);
    color: var(--interactive);
    font-weight: 500;
    animation: pulse-text 1.5s ease-in-out infinite;
  }

  @keyframes pulse-text {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .HotkeyRecorder__empty {
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .HotkeyRecorder__error {
    font-size: var(--text-xs);
    color: var(--destructive);
    margin: 0;
  }

  .HotkeyRecorder__conflict {
    padding: var(--space-2) var(--space-3);
    background-color: hsl(var(--warning, 38 92% 50%) / 0.1);
    border: 1px solid hsl(var(--warning, 38 92% 50%) / 0.3);
    border-radius: var(--radius-md);
  }

  .HotkeyRecorder__conflict-text {
    font-size: var(--text-xs);
    color: var(--foreground);
    margin: 0;
    line-height: 1.5;
  }

  :global(.HotkeyRecorder__footer) {
    border-top: 1px solid var(--border);
    padding-top: var(--space-3);
  }
</style>
