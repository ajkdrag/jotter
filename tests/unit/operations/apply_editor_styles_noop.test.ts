import { describe, it, expect } from 'vitest'
import { apply_editor_styles } from '$lib/operations/apply_editor_styles'
import type { EditorSettings } from '$lib/types/editor_settings'

describe('apply_editor_styles (no document)', () => {
  it('does not throw when document is undefined', () => {
    const original_document = globalThis.document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).document

    const settings: EditorSettings = {
      font_size: 1,
      line_height: 1.5,
      heading_color: 'inherit',
      spacing: 'normal'
    }

    expect(() => apply_editor_styles(settings)).not.toThrow()

    globalThis.document = original_document
  })
})
