import { defaultKeymap } from '@codemirror/commands'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { codeBlockConfig } from '@milkdown/components/code-block'
import type { Ctx } from '@milkdown/kit/ctx'
import { basicSetup } from 'codemirror'

export function configure_codemirror_codeblocks(ctx: Ctx) {
  ctx.update(codeBlockConfig.key, (prev) => ({
    ...prev,
    languages,
    extensions: [basicSetup, oneDark, keymap.of(defaultKeymap)]
  }))
}

