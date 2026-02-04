import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import type { ImagePasteData } from '$lib/types/image_paste'

function find_image_file(clipboard_data: DataTransfer): File | null {
  for (const file of Array.from(clipboard_data.files)) {
    if (file.type.startsWith('image/')) return file
  }

  for (const item of Array.from(clipboard_data.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }

  return null
}

function load_dimensions(bytes: Uint8Array, mime_type: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const buffer =
      bytes.buffer instanceof ArrayBuffer
        ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        : Uint8Array.from(bytes).buffer
    const blob = new Blob([buffer], { type: mime_type })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode pasted image'))
    }

    img.src = url
  })
}

async function extract_image_data(file: File): Promise<ImagePasteData> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime_type = file.type || 'image/png'
  const { width, height } = await load_dimensions(bytes, mime_type)
  return {
    original_bytes: bytes,
    original_name: file.name || 'pasted-image',
    mime_type,
    width,
    height
  }
}

export function create_image_paste_plugin(on_image_paste: (data: ImagePasteData) => void) {
  return $prose(() => new Plugin({
    props: {
      handlePaste: (view, event) => {
        const editable = view.props.editable?.(view.state)
        const { clipboardData } = event
        if (!editable || !clipboardData) return false

        const current_node = view.state.selection.$from.node()
        if (current_node.type.spec.code) return false

        const image_file = find_image_file(clipboardData)
        if (!image_file) return false

        void extract_image_data(image_file)
          .then(on_image_paste)
          .catch((error: unknown) => {
            console.error('Failed to process pasted image:', error)
          })

        event.preventDefault()
        return true
      }
    }
  }))
}
