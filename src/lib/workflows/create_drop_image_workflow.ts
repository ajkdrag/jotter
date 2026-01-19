import type { MilkdownHandle } from '$lib/adapters/editor/milkdown_adapter'
import { is_tauri } from '$lib/adapters/detect_platform'
import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { insert_dropped_image } from '$lib/operations/insert_dropped_image'

export function create_drop_image_workflow() {
  let unlisten: (() => void | Promise<void>) | null = null

  type DragDropPayload =
    | { type: 'drop'; paths: string[] }
    | { type: 'enter'; paths: string[] }
    | { type: 'over'; paths: string[] }
    | { type: 'leave'; paths: string[] }

  async function handle_file_path(path: string, handle: MilkdownHandle) {
    const vault = app_state.vault
    const open = app_state.open_note
    if (!vault || !open) return
    const { asset_path } = await insert_dropped_image(
      { assets: ports.assets },
      { vault_id: vault.id, note_id: open.meta.id, source: { kind: 'path', path } }
    )
    const name = path.split(/[\\/]/).pop()
    handle.insert_image({ src: asset_path, alt: name ?? '' })
  }

  return {
    async bind_to_editor(handle: MilkdownHandle) {
      if (unlisten) return
      if (is_tauri) {
        try {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
          const win = getCurrentWebviewWindow()
          unlisten = await win.onDragDropEvent((e) => {
            const payload = (e as { payload?: unknown })?.payload as unknown
            if (!payload || typeof payload !== 'object') return
            const p = payload as Partial<DragDropPayload>
            if (p.type !== 'drop') return
            const paths = Array.isArray(p.paths) ? p.paths : []
            for (const p of paths) {
              const ext = p.split('.').pop()?.toLowerCase() ?? ''
              if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) continue
              void handle_file_path(p, handle)
            }
          })
          return
        } catch {
        }
      }

      const on_drop = (e: DragEvent) => {
          e.preventDefault()
          const files = e.dataTransfer?.files
          if (!files || files.length === 0) return
          Array.from(files).forEach((file) => {
            const is_image = file.type.startsWith('image/')
            if (!is_image) return
            void file.arrayBuffer().then((buf) => {
              const vault = app_state.vault
              const open = app_state.open_note
              if (!vault || !open) return
              void insert_dropped_image(
                { assets: ports.assets },
                {
                  vault_id: vault.id,
                  note_id: open.meta.id,
                  source: { kind: 'bytes', bytes: new Uint8Array(buf), file_name: file.name }
                }
              ).then(({ asset_path }) => handle.insert_image({ src: asset_path, alt: file.name }))
            })
          })
        }

        const on_dragover = (e: DragEvent) => e.preventDefault()

      window.addEventListener('drop', on_drop)
      window.addEventListener('dragover', on_dragover)
      unlisten = () => {
        window.removeEventListener('drop', on_drop)
        window.removeEventListener('dragover', on_dragover)
      }
    },
    async destroy() {
      if (!unlisten) return
      await unlisten()
      unlisten = null
    }
  }
}
