function strip_md_extension(value: string): string {
  return value.endsWith(".md") ? value.slice(0, -3) : value;
}

export function format_wiki_display(vault_path: string): string {
  return strip_md_extension(vault_path);
}

export function format_markdown_link(path: string, title: string): string {
  return `[${title}](<${path}>)`;
}
