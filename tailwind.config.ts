import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        fg: 'hsl(var(--fg))',
        muted: 'hsl(var(--muted))',
        panel: 'hsl(var(--panel))',
        panel2: 'hsl(var(--panel-2))',
        border: 'hsl(var(--border))',
        accent: 'hsl(var(--accent))',
        accent2: 'hsl(var(--accent-2))'
      },
      borderRadius: {
        xl: '18px'
      }
    }
  },
  plugins: []
} satisfies Config

