<script lang="ts">
  import { onMount } from "svelte";
  import AppShellDialogs from "$lib/components/app_shell_dialogs.svelte";
  import AppSidebar from "$lib/components/app_sidebar.svelte";
  import VaultSelectionPanel from "$lib/components/vault_selection_panel.svelte";
  import { use_keyboard_shortcuts } from "$lib/hooks/use_keyboard_shortcuts.svelte";
  import { use_app_context } from "$lib/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/actions/action_ids";
  import type { VaultId } from "$lib/types/ids";

  type Props = {
    hide_choose_vault_button?: boolean;
  };

  let { hide_choose_vault_button = false }: Props = $props();

  const { stores, action_registry } = use_app_context();

  const has_vault = $derived(stores.vault.vault !== null);
  const omnibar_open = $derived(stores.ui.omnibar.open);

  const any_blocking_dialog_open = $derived(
    stores.ui.system_dialog_open ||
      stores.ui.change_vault.open ||
      stores.ui.delete_note_dialog.open ||
      stores.ui.rename_note_dialog.open ||
      stores.ui.save_note_dialog.open ||
      stores.ui.settings_dialog.open ||
      stores.ui.create_folder_dialog.open ||
      stores.ui.delete_folder_dialog.open ||
      stores.ui.rename_folder_dialog.open,
  );

  const vault_selection_loading = $derived(
    stores.ui.startup.status === "loading" || stores.ui.change_vault.is_loading,
  );

  const keyboard = use_keyboard_shortcuts({
    is_enabled: () => has_vault,
    is_blocked: () => any_blocking_dialog_open || omnibar_open,
    is_omnibar_open: () => omnibar_open,
    on_toggle_omnibar: () => {
      void action_registry.execute(ACTION_IDS.omnibar_toggle);
    },
    on_open_omnibar_commands: () => {
      void action_registry.execute(ACTION_IDS.omnibar_open);
      void action_registry.execute(ACTION_IDS.omnibar_set_query, ">");
    },
    on_open_omnibar_notes: () => {
      void action_registry.execute(ACTION_IDS.omnibar_open);
    },
    on_toggle_sidebar: () => {
      void action_registry.execute(ACTION_IDS.ui_toggle_sidebar);
    },
    on_save: () => {
      void action_registry.execute(ACTION_IDS.note_request_save);
    },
  });

  function handle_choose_vault_dir() {
    void action_registry.execute(ACTION_IDS.vault_choose);
  }

  function handle_select_vault(vault_id: VaultId) {
    void action_registry.execute(ACTION_IDS.vault_select, vault_id);
  }

  onMount(() => {
    void action_registry.execute(ACTION_IDS.app_mounted);
  });
</script>

{#if !has_vault}
  <div class="mx-auto max-w-[65ch] p-8">
    <VaultSelectionPanel
      recent_vaults={stores.vault.recent_vaults}
      current_vault_id={null}
      is_loading={vault_selection_loading}
      error={stores.ui.startup.error ?? stores.ui.change_vault.error}
      on_choose_vault_dir={handle_choose_vault_dir}
      on_select_vault={handle_select_vault}
      {hide_choose_vault_button}
    />
  </div>
{:else}
  <main>
    <AppSidebar />
  </main>
{/if}

<AppShellDialogs {hide_choose_vault_button} />

<svelte:window
  onkeydowncapture={keyboard.handle_keydown_capture}
  onkeydown={keyboard.handle_keydown}
/>
