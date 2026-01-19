import { goto } from '$app/navigation'
import type { NavigationPort } from '$lib/ports/navigation_port'

export function create_navigation_adapter(): NavigationPort {
  return {
    async navigate_to_home() {
      await goto('/')
    },

    async navigate_to_vault_selection() {
      await goto('/vault')
    },

    async navigate_to_note(note_path: string) {
      await goto(`/note/${note_path}`)
    }
  }
}
