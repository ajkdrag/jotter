import { toast } from 'svelte-sonner'
import type { OpStore } from '$lib/stores/op_store.svelte'
import { logger } from '$lib/utils/logger'

export function create_op_toast_reactor(op_store: OpStore): () => void {
  let last_clipboard_status = op_store.get('clipboard.write').status
  let last_theme_status = op_store.get('theme.set').status

  return $effect.root(() => {
    $effect(() => {
      const clipboard = op_store.get('clipboard.write')
      const theme_set = op_store.get('theme.set')

      if (clipboard.status !== last_clipboard_status) {
        last_clipboard_status = clipboard.status

        if (clipboard.status === 'success') {
          toast.success('Copied to clipboard')
        }

        if (clipboard.status === 'error') {
          logger.error(`Clipboard write failed: ${clipboard.error ?? 'unknown error'}`)
          toast.error('Failed to copy to clipboard')
        }
      }

      if (theme_set.status !== last_theme_status) {
        last_theme_status = theme_set.status

        if (theme_set.status === 'error') {
          logger.error(`Theme update failed: ${theme_set.error ?? 'unknown error'}`)
          toast.error('Failed to update theme')
        }
      }
    })
  })
}
