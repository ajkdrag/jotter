export function note_route(note_path: string): string {
  const encoded = note_path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `/note/${encoded}`
}

