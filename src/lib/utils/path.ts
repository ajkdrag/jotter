export function parent_folder_path(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

export function note_name_from_path(path: string): string {
  const last_slash = path.lastIndexOf("/");
  const filename = last_slash >= 0 ? path.slice(last_slash + 1) : path;
  return filename.endsWith(".md") ? filename.slice(0, -3) : filename;
}
