export function detect_platform(): { is_tauri: boolean; is_web: boolean } {
  if (typeof window === 'undefined') {
    return { is_tauri: false, is_web: false }
  }

  const is_tauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window

  return {
    is_tauri,
    is_web: !is_tauri
  }
}

export const { is_tauri, is_web } = detect_platform()
