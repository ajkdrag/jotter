export {
  type DocumentFileType,
  detect_file_type,
} from "$lib/features/document/domain/document_types";
export {
  DocumentStore,
  type DocumentViewerState,
} from "$lib/features/document/state/document_store.svelte";
export { type DocumentPort } from "$lib/features/document/ports";
export { create_document_tauri_adapter } from "$lib/features/document/adapters/document_tauri_adapter";
export { register_document_actions } from "$lib/features/document/application/document_actions";
export { default as DocumentViewer } from "$lib/features/document/ui/document_viewer.svelte";
