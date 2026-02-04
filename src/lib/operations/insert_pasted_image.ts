import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
import { as_asset_path } from '$lib/types/ids'

const KNOWN_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'tiff',
  'avif'
])

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/avif': 'avif'
}

function normalize_folder(folder: string): string {
  const trimmed = folder.trim().replace(/\\/g, '/')
  const without_prefix = trimmed.replace(/^\.\/+/, '').replace(/^\/+/, '')
  const without_suffix = without_prefix.replace(/\/+$/, '')
  return without_suffix === '' ? '.assets' : without_suffix
}

function strip_known_extension(name: string): string {
  const trimmed = name.trim()
  const match = trimmed.match(/^(.*)\.([a-z0-9]+)$/i)
  if (!match) return trimmed
  const ext = match[2]?.toLowerCase() ?? ''
  if (!KNOWN_EXTENSIONS.has(ext)) return trimmed
  return match[1] ?? trimmed
}

function slugify_name(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'image' : slug
}

function resolve_display_name(name: string): string {
  const stripped = strip_known_extension(name)
  const trimmed = stripped.trim()
  return trimmed === '' ? 'image' : trimmed
}

function escape_alt_text(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\]/g, '\\]')
}

function extension_from_source(source: AssetImportSource, mime_type: string): string {
  const name = source.kind === 'path' ? source.path.split(/[\\/]/).pop() ?? '' : source.file_name
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext && ext !== name.toLowerCase()) return ext
  return MIME_EXTENSION_MAP[mime_type] ?? 'bin'
}

export async function insert_pasted_image(
  ports: { assets: AssetsPort },
  args: {
    vault_id: VaultId
    source: AssetImportSource
    attachments_folder: string
    display_name: string
    mime_type: string
  }
): Promise<{ asset_path: AssetPath; markdown: string }> {
  const ts = Date.now()
  const folder = normalize_folder(args.attachments_folder)
  const display_name = resolve_display_name(args.display_name)
  const slug = slugify_name(display_name)
  const ext = extension_from_source(args.source, args.mime_type)
  const target_path = as_asset_path(`${folder}/${slug}-${String(ts)}.${ext}`)
  const asset_path = await ports.assets.import_asset(args.vault_id, args.source, target_path)
  const alt_text = escape_alt_text(display_name)
  const markdown = `![${alt_text}](${asset_path})`
  return { asset_path, markdown }
}
