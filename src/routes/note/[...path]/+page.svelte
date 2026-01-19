<script lang="ts">
  import NoteWorkspace from '$lib/components/note_workspace.svelte'
  import { page } from '$app/state'
</script>

<NoteWorkspace note_path={page.params.path} />
