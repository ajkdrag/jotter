import type { AssetPath, NotePath } from "$lib/shared/types/ids";

function parts(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function encode_path(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function to_markdown_asset_target(
  note_path: NotePath,
  asset_path: AssetPath,
): string {
  const note_dir = parts(note_path).slice(0, -1);
  const asset = parts(asset_path);

  let common = 0;
  while (
    common < note_dir.length &&
    common < asset.length &&
    note_dir[common] === asset[common]
  ) {
    common += 1;
  }

  const up: string[] = Array.from(
    { length: note_dir.length - common },
    () => "..",
  );
  const down = asset.slice(common);
  const relative = [...up, ...down].join("/");
  return encode_path(relative);
}

export function resolve_relative_asset_path(
  note_path: string,
  relative_src: string,
): string {
  const note_dir = parts(note_path).slice(0, -1);
  const src_parts = parts(relative_src);

  const resolved = [...note_dir];
  for (const segment of src_parts) {
    if (segment === "..") {
      resolved.pop();
    } else if (segment !== ".") {
      resolved.push(segment);
    }
  }

  return resolved.join("/");
}
