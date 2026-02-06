import { create_app_stores } from '$lib/stores/create_app_stores'
import type { AppStores } from '$lib/stores/create_app_stores'

export function create_mock_stores(options?: { now_ms?: () => number }): AppStores {
  if (options?.now_ms) {
    return create_app_stores({ now_ms: options.now_ms })
  }
  return create_app_stores()
}
