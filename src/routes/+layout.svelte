<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import '../app.css'
  import { init_theme } from '$lib/utils/theme'

  import nord_css from '@milkdown/theme-nord/style.css?raw'

  let cleanup: (() => void) | undefined

  onMount(() => {
    cleanup = init_theme()

    const id = 'imdown-milkdown-nord-css'
    if (document.getElementById(id)) return

    const el = document.createElement('style')
    el.id = id
    el.textContent = nord_css
    document.head.appendChild(el)
  })

  onDestroy(() => {
    cleanup?.()
  })
</script>

<slot />
