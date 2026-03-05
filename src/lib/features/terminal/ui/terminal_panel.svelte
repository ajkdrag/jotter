<script lang="ts">
  import "@xterm/xterm/css/xterm.css";
  import { spawn, type IPty } from "tauri-pty";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { onMount, onDestroy } from "svelte";
  import { use_app_context } from "$lib/app/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/app";
  import { X } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { create_logger } from "$lib/shared/utils/logger";

  const log = create_logger("terminal_panel");
  const { stores, action_registry } = use_app_context();

  let container_el: HTMLDivElement | undefined = $state();
  let terminal: Terminal | undefined;
  let fit_addon: FitAddon | undefined;
  let pty_process: IPty | undefined;
  let resize_observer: ResizeObserver | undefined;

  function get_shell(): string {
    return "/bin/zsh";
  }

  function spawn_pty(cols: number, rows: number) {
    const vault_path = stores.vault.vault?.path ?? undefined;
    const shell = get_shell();

    try {
      const opts: Record<string, unknown> = { cols, rows, env: {} };
      if (vault_path) opts.cwd = vault_path as string;

      pty_process = spawn(shell, [], opts as Parameters<typeof spawn>[2]);

      pty_process.onData((data: Uint8Array) => {
        terminal?.write(data);
      });

      pty_process.onExit(({ exitCode }) => {
        log.info("PTY exited", { exitCode });
        terminal?.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
        pty_process = undefined;
      });
    } catch (error) {
      log.error("Failed to spawn PTY", { error: String(error) });
      terminal?.write(`\r\nFailed to start terminal: ${error}\r\n`);
    }
  }

  function init_terminal() {
    if (!container_el) return;

    terminal = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: "var(--terminal-bg, #1e1e2e)",
        foreground: "var(--terminal-fg, #cdd6f4)",
        cursor: "var(--terminal-cursor, #f5e0dc)",
      },
    });

    fit_addon = new FitAddon();
    terminal.loadAddon(fit_addon);
    terminal.open(container_el);
    fit_addon.fit();

    terminal.onData((data: string) => {
      pty_process?.write(data);
    });

    spawn_pty(terminal.cols, terminal.rows);

    resize_observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!fit_addon || !terminal) return;
        try {
          fit_addon.fit();
          pty_process?.resize(terminal.cols, terminal.rows);
        } catch {
          // ignore resize errors during teardown
        }
      });
    });
    resize_observer.observe(container_el);
  }

  function cleanup() {
    resize_observer?.disconnect();
    resize_observer = undefined;
    pty_process?.kill();
    pty_process = undefined;
    terminal?.dispose();
    terminal = undefined;
    fit_addon = undefined;
  }

  onMount(() => {
    init_terminal();
  });

  onDestroy(() => {
    cleanup();
  });
</script>

<div class="TerminalPanel">
  <div class="TerminalPanel__header">
    <span class="TerminalPanel__title">Terminal</span>
    <Button
      variant="ghost"
      size="icon"
      class="TerminalPanel__close"
      onclick={() => void action_registry.execute(ACTION_IDS.terminal_close)}
    >
      <X class="TerminalPanel__close-icon" />
    </Button>
  </div>
  <div class="TerminalPanel__body" bind:this={container_el}></div>
</div>

<style>
  .TerminalPanel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--terminal-bg, #1e1e2e);
    border-block-start: 1px solid var(--border);
  }

  .TerminalPanel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--size-touch-md, 32px);
    padding-inline: var(--space-3);
    flex-shrink: 0;
    background: var(--sidebar);
    border-block-end: 1px solid var(--border);
  }

  .TerminalPanel__title {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.TerminalPanel__close) {
    width: var(--size-touch-sm, 24px);
    height: var(--size-touch-sm, 24px);
    color: var(--muted-foreground);
  }

  :global(.TerminalPanel__close:hover) {
    color: var(--foreground);
  }

  :global(.TerminalPanel__close-icon) {
    width: var(--size-icon-xs, 14px);
    height: var(--size-icon-xs, 14px);
  }

  .TerminalPanel__body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: var(--space-1) var(--space-2);
  }
</style>
