const EXTERNAL_LINK_REGEX = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;

export type ExternalLink = {
  url: string;
  text: string;
};

export function extract_external_links(markdown: string): ExternalLink[] {
  const seen = new Set<string>();
  const results: ExternalLink[] = [];

  for (const match of markdown.matchAll(EXTERNAL_LINK_REGEX)) {
    const url = match[2];
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const text = match[1]?.trim() || url;
    results.push({ url, text });
  }

  return results;
}
