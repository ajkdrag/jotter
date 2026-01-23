<script lang="ts">
  import "../app.css";
  import VaultDialog from "$lib/components/vault_dialog.svelte";
  import DeleteNoteDialog from "$lib/components/delete_note_dialog.svelte";
  import { app_state } from "$lib/adapters/state/app_state.svelte";
  import { create_prod_ports } from "$lib/adapters/create_prod_ports";
  import { create_home_controller } from "$lib/controllers/home_controller";
  import { delete_note_flow_machine } from "$lib/flows/delete_note_flow";
  import { createActor } from "xstate";
  import { setContext, onDestroy } from "svelte";
  import type { NoteMeta } from "$lib/types/note";

  let { children } = $props();

  const ports = create_prod_ports();
  const controller = create_home_controller({ ports, state: app_state });

  const delete_note_actor = createActor(delete_note_flow_machine, {
    input: {
      ports: { notes: ports.notes, index: ports.index },
      app_state
    }
  });
  delete_note_actor.start();

  let delete_flow_snapshot = $state(delete_note_actor.getSnapshot());
  const subscription = delete_note_actor.subscribe((snapshot) => {
    delete_flow_snapshot = snapshot;
  });

  onDestroy(() => {
    subscription.unsubscribe();
    delete_note_actor.stop();
  });

  function request_delete_note(note: NoteMeta) {
    delete_note_actor.send({ type: "REQUEST_DELETE", note });
  }

  function confirm_delete() {
    delete_note_actor.send({ type: "CONFIRM" });
  }

  function cancel_delete() {
    delete_note_actor.send({ type: "CANCEL" });
  }

  function retry_delete() {
    delete_note_actor.send({ type: "RETRY" });
  }

  setContext("delete_note_flow", {
    request_delete: request_delete_note
  });

  const delete_dialog_open = $derived(
    delete_flow_snapshot.matches("confirming") ||
    delete_flow_snapshot.matches("deleting") ||
    delete_flow_snapshot.matches("error")
  );
</script>

<main>
  {@render children()}
</main>

<VaultDialog
  open={controller.is_change_vault_dialog_open}
  onOpenChange={controller.toggle_change_vault_dialog_state}
  recent_vaults={controller.recent_vaults}
  current_vault_id={controller.vault?.id ?? null}
  onChooseVaultDir={controller.on_choose_vault}
  onSelectVault={controller.on_select_vault}
  onLoadRecent={controller.on_load_recent}
/>

<DeleteNoteDialog
  open={delete_dialog_open}
  note={delete_flow_snapshot.context.note_to_delete}
  is_deleting={delete_flow_snapshot.matches("deleting")}
  error={delete_flow_snapshot.context.error}
  onConfirm={confirm_delete}
  onCancel={cancel_delete}
  onRetry={retry_delete}
/>
