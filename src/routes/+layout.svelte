<script lang="ts">
  import { onMount } from 'svelte'
  import '../app.css'

  import nord_css from '@milkdown/theme-nord/style.css?raw'

  onMount(() => {
    const id = 'imdown-milkdown-nord-css'
    if (document.getElementById(id)) return

    const el = document.createElement('style')
    el.id = id
    el.textContent = nord_css
    document.head.appendChild(el)
  })
</script>

<slot />
