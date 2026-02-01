import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { apply_editor_styles } from '$lib/operations/apply_editor_styles'
import type { EditorSettings } from '$lib/types/editor_settings'

describe('apply_editor_styles', () => {
  const settings: EditorSettings = {
    font_size: 1.25,
    line_height: 1.8,
    heading_color: 'accent',
    spacing: 'spacious'
  }

  const original_document = globalThis.document

  beforeEach(() => {
    const root = {
      style: {
        setProperty: (name: string, value: string) => {
          store.set(name, value)
        }
      }
    }
    const store = new Map<string, string>()
    const document_stub = { documentElement: root }
    Object.defineProperty(document_stub, '_store', { value: store })
    globalThis.document = document_stub as Document
  })

  afterEach(() => {
    globalThis.document = original_document
  })

  it('writes css variables for editor settings', () => {
    apply_editor_styles(settings)

    const store = (globalThis.document as unknown as { _store: Map<string, string> })._store
    expect(store.get('--editor-font-size')).toBe('1.25rem')
    expect(store.get('--editor-line-height')).toBe('1.8')
    expect(store.get('--editor-heading-color')).toBe('var(--accent-foreground)')
    expect(store.get('--editor-spacing')).toBe('2rem')
  })
})
