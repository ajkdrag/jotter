import { app_state } from '$lib/adapters/state/app_state.svelte'

export function reset_app_state_for_backend_switch(state: typeof app_state) {
  state.vault = null
  state.recent_vaults = []
  state.notes = []
  state.open_note = null
}
