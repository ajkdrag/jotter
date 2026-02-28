import type { UIStore } from "$lib/app";
import type { SettingsService } from "$lib/features/settings";

const PERSIST_DELAY_MS = 1000;

export function create_recent_commands_persist_reactor(
  ui_store: UIStore,
  settings_service: SettingsService,
): () => void {
  let last_saved_serialized: string | null = null;
  let pending_ids: string[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function schedule_persist(ids: string[]) {
    const serialized = JSON.stringify(ids);
    if (serialized === last_saved_serialized) return;
    pending_ids = ids;

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      const to_save = pending_ids;
      pending_ids = null;
      timer = null;
      if (!to_save) return;
      void settings_service.save_recent_command_ids(to_save).then(() => {
        last_saved_serialized = JSON.stringify(to_save);
      });
    }, PERSIST_DELAY_MS);
  }

  function flush_pending() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending_ids) return;
    const to_save = pending_ids;
    pending_ids = null;
    void settings_service.save_recent_command_ids(to_save).then(() => {
      last_saved_serialized = JSON.stringify(to_save);
    });
  }

  return $effect.root(() => {
    $effect(() => {
      const ids = ui_store.recent_command_ids;
      schedule_persist(ids);
    });

    return () => {
      flush_pending();
    };
  });
}
