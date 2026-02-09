export type VaultId = string & { readonly __brand: "VaultId" };
export type VaultPath = string & { readonly __brand: "VaultPath" };

export type NotePath = string & { readonly __brand: "NotePath" };
export type NoteId = NotePath;

export type MarkdownText = string & { readonly __brand: "MarkdownText" };
export type AssetPath = string & { readonly __brand: "AssetPath" };

export function as_vault_id(value: string): VaultId {
  return value as VaultId;
}

export function as_vault_path(value: string): VaultPath {
  return value as VaultPath;
}

export function as_note_path(value: string): NotePath {
  return value as NotePath;
}

export function as_markdown_text(value: string): MarkdownText {
  return value as MarkdownText;
}

export function as_asset_path(value: string): AssetPath {
  return value as AssetPath;
}
