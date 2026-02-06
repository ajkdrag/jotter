import type { NoteMeta } from '$lib/types/note'
import type { AppEvent } from '$lib/events/app_event'
import { create_untitled_open_note_in_folder } from '$lib/utils/ensure_open_note'

export function create_untitled_note_use_case(args: {
  notes: NoteMeta[]
  folder_prefix: string
  now_ms: number
}): AppEvent[] {
  const new_note = create_untitled_open_note_in_folder({
    notes: args.notes,
    folder_prefix: args.folder_prefix,
    now_ms: args.now_ms
  })

  return [
    { type: 'open_note_set', open_note: new_note },
    { type: 'ui_selected_folder_set', path: args.folder_prefix }
  ]
}
