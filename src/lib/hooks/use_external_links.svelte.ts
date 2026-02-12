export function use_external_links(input: {
  open_url: (url: string) => Promise<void>;
}) {
  function is_external_url(href: string): boolean {
    try {
      const url = new URL(href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function handle_click(event: MouseEvent) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const href = anchor.getAttribute("href");
    if (!href || !is_external_url(href)) return;

    event.preventDefault();
    void input.open_url(href);
  }

  return { handle_click };
}
