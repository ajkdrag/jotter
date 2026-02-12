import type { ShellPort } from "$lib/ports/shell_port";

export function create_shell_web_adapter(): ShellPort {
  return {
    open_url(url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return Promise.resolve();
    },
  };
}
