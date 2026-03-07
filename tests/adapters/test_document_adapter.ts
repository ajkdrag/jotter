import type { DocumentPort } from "$lib/features/document";

export function create_test_document_adapter(): DocumentPort {
  return {
    read_file: () => Promise.resolve(""),
    resolve_asset_url: () => "",
  };
}
