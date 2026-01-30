import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'

describe('task list styling', () => {
  test('does not treat nested checked items as parent completion', () => {
    const css = readFileSync(new URL('../src/styles/editor.css', import.meta.url), 'utf-8')

    expect(css).toContain(
      '.milkdown-list-item-block > .list-item:has(> .label-wrapper .label.checked) > .children'
    )
    expect(css).not.toContain('.milkdown-list-item-block > .list-item:has(.label.checked) > .children')
  })
})

