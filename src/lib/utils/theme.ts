export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'imdown:theme'

function get_system_theme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply_theme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  root.removeAttribute('data-theme')
  
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark')
  } else {
    root.setAttribute('data-theme', 'light')
  }
}

export function get_effective_theme(preference: Theme): 'light' | 'dark' {
  if (preference === 'system') {
    return get_system_theme()
  }
  return preference
}

export function init_theme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  
  const stored = localStorage.getItem(THEME_KEY) as Theme | null
  const preference: Theme = stored ?? 'system'
  
  const effective = get_effective_theme(preference)
  apply_theme(effective)
  
  if (preference === 'system') {
    const media_query = window.matchMedia('(prefers-color-scheme: dark)')
    const handle_change = () => {
      const effective = get_effective_theme('system')
      apply_theme(effective)
    }
    media_query.addEventListener('change', handle_change)
    
    return () => {
      media_query.removeEventListener('change', handle_change)
    }
  }
}

export function set_theme(preference: Theme) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(THEME_KEY, preference)
  const effective = get_effective_theme(preference)
  apply_theme(effective)
  
  if (preference === 'system') {
    const media_query = window.matchMedia('(prefers-color-scheme: dark)')
    const handle_change = () => {
      const effective = get_effective_theme('system')
      apply_theme(effective)
    }
    media_query.addEventListener('change', handle_change)
  }
}

export function get_theme(): Theme {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem(THEME_KEY) as Theme) ?? 'system'
}
