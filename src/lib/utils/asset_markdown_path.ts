import type { AssetPath, NotePath } from "$lib/types/ids";

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
