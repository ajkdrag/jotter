import type { EditorPort } from '$lib/ports/editor_port'

export function insert_editor_text(
	ports: { editor: EditorPort },
	args: { text: string }
): void {
	ports.editor.insert_text_at_cursor(args.text)
}
