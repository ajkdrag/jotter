export interface NavigationPort {
  navigate_to_home(): Promise<void>
  navigate_to_vault_selection(): Promise<void>
  navigate_to_note(note_path: string): Promise<void>
}
