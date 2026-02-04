import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { AssetPath } from '$lib/types/ids'
import { as_asset_path } from '$lib/types/ids'

type ResolveAssetUrl = (asset_path: AssetPath) => Promise<string>

function is_external_src(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src)
}

export function create_asset_image_plugin(resolve_asset_url: ResolveAssetUrl) {
  return $prose(() => new Plugin({
    props: {
      nodeViews: {
        image: (node: ProseNode) => {
          const img = document.createElement('img')
          img.loading = 'lazy'

          let current_src = ''
          let resolve_token = 0
          let destroyed = false

          const update_dom = (next_node: ProseNode) => {
            const alt = String(next_node.attrs.alt ?? '')
            img.alt = alt
            if (next_node.attrs.title) {
              img.title = String(next_node.attrs.title)
            } else {
              img.removeAttribute('title')
            }
          }

          const resolve_src = (raw_src: string) => {
            if (raw_src === '') {
              img.removeAttribute('src')
              return
            }

            if (is_external_src(raw_src)) {
              img.src = raw_src
              return
            }

            const token = resolve_token + 1
            resolve_token = token

            void resolve_asset_url(as_asset_path(raw_src))
              .then((resolved) => {
                if (destroyed || token !== resolve_token) return
                img.src = resolved
              })
              .catch((error: unknown) => {
                if (destroyed || token !== resolve_token) return
                console.error('Failed to resolve asset URL:', error)
                img.src = raw_src
              })
          }

          update_dom(node)
          current_src = String(node.attrs.src ?? '')
          resolve_src(current_src)

          return {
            dom: img,
            update: (next_node: ProseNode) => {
              if (next_node.type.name !== 'image') return false
              update_dom(next_node)

              const next_src = String(next_node.attrs.src ?? '')
              if (next_src !== current_src) {
                current_src = next_src
                resolve_src(current_src)
              }

              return true
            },
            destroy: () => {
              destroyed = true
            }
          }
        }
      }
    }
  }))
}
