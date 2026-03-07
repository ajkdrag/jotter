<script lang="ts">
  import { onMount } from "svelte";
  import type { EditorView } from "@codemirror/view";

  interface Props {
    content: string;
    file_type?: string;
  }

  let { content, file_type = "text" }: Props = $props();

  let container: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;

  onMount(() => {
    let destroyed = false;

    Promise.all([import("codemirror"), import("@codemirror/state")]).then(
      ([{ EditorView, basicSetup }, { EditorState }]) => {
        if (destroyed || !container) return;

        view = new EditorView({
          doc: content,
          extensions: [
            basicSetup,
            EditorView.lineWrapping,
            EditorState.readOnly.of(true),
            EditorView.theme({
              "&": { height: "100%", fontSize: "var(--text-sm, 13px)" },
              ".cm-scroller": {
                overflow: "auto",
                fontFamily: "var(--font-mono, monospace)",
              },
            }),
          ],
          parent: container,
        });
      },
    );

    return () => {
      destroyed = true;
      view?.destroy();
    };
  });

  $effect(() => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      });
    }
  });
</script>

<div class="CodeViewer" bind:this={container}></div>

<style>
  .CodeViewer {
    height: 100%;
    overflow: hidden;
    background-color: var(--background);
    color: var(--foreground);
  }
</style>
