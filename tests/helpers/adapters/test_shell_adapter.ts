import type { ShellPort } from "$lib/features/shell";

export function create_test_shell_adapter(): ShellPort & {
  _calls: { open_url: string[] };
} {
  const calls = { open_url: [] as string[] };

  return {
    _calls: calls,
    open_url(url) {
      calls.open_url.push(url);
      return Promise.resolve();
    },
  };
}
