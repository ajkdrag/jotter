import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, NoteId, VaultId } from '$lib/types/ids'
import { as_asset_path } from '$lib/types/ids'

function slugify_note_id(note_id: NoteId): string {
  const file = String(note_id).split('/').pop() ?? String(note_id)
  const stem = file.endsWith('.md') ? file.slice(0, -3) : file
  return stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extension_from_source(source: AssetImportSource): string {
  const name = source.kind === 'path' ? source.path.split(/[\\/]/).pop() ?? '' : source.file_name
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext || ext === name.toLowerCase()) return 'bin'
  return ext
}

export async function insert_dropped_image(
  ports: { assets: AssetsPort },
  args: { vault_id: VaultId; note_id: NoteId; source: AssetImportSource }
): Promise<{ asset_path: AssetPath }> {
  const ts = Date.now()
  const slug = slugify_note_id(args.note_id)
  const ext = extension_from_source(args.source)
  const target_path = as_asset_path(`.assets/${slug}-${ts}.${ext}`)
  const asset_path = await ports.assets.import_asset(args.vault_id, args.source, target_path)
  return { asset_path }
}
