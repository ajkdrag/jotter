import { $ctx, $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { Node } from '@milkdown/kit/prose/model'

export type DirtyStateChangeCallback = (is_dirty: boolean) => void

export const dirty_state_plugin_key = new PluginKey('MILKDOWN_DIRTY_STATE')

export type DirtyStatePluginConfig = {
  on_dirty_state_change: DirtyStateChangeCallback
}

export const dirty_state_plugin_config_key = $ctx<DirtyStatePluginConfig, 'dirty_state_plugin_config'>(
  {
    on_dirty_state_change: () => {}
  } as DirtyStatePluginConfig,
  'dirty_state_plugin_config'
)

type PluginState = {
  saved_doc: Node | null
  is_dirty: boolean
}

export const dirty_state_plugin = $prose((ctx) => {
  const config = ctx.get(dirty_state_plugin_config_key.key)

  return new Plugin<PluginState>({
    key: dirty_state_plugin_key,
    state: {
      init() {
        return {
          saved_doc: null,
          is_dirty: false
        }
      },
      apply(tr, plugin_state, _old_state, new_state) {
        if (plugin_state.saved_doc === null) {
          return {
            saved_doc: new_state.doc,
            is_dirty: false
          }
        }

        if (tr.getMeta(dirty_state_plugin_key)?.action === 'mark_clean') {
          if (plugin_state.is_dirty) {
            config.on_dirty_state_change(false)
          }
          return {
            saved_doc: new_state.doc,
            is_dirty: false
          }
        }

        if (tr.docChanged) {
          const current_is_dirty = !new_state.doc.eq(plugin_state.saved_doc)

          if (current_is_dirty !== plugin_state.is_dirty) {
            config.on_dirty_state_change(current_is_dirty)
          }

          return {
            ...plugin_state,
            is_dirty: current_is_dirty
          }
        }

        return plugin_state
      }
    }
  })
})
