mod constants;
mod notes_service;
mod index_service;
mod search_db;
mod watcher_service;
mod storage;
mod vault_service;
mod settings_service;
mod vault_settings_service;

include!(concat!(env!("OUT_DIR"), "/icon_stamp.rs"));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = ICON_STAMP;
    tauri::Builder::default()
        .manage(watcher_service::WatcherState::default())
        .manage(index_service::SearchDbState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            vault_service::open_vault,
            vault_service::open_vault_by_id,
            vault_service::list_vaults,
            vault_service::remember_last_vault,
            vault_service::get_last_vault_id,
            watcher_service::watch_vault,
            watcher_service::unwatch_vault,
            index_service::index_build,
            index_service::index_search,
            index_service::index_suggest,
            index_service::index_upsert_note,
            index_service::index_remove_note,
            index_service::index_remove_notes,
            index_service::index_backlinks,
            index_service::index_outlinks,
            notes_service::list_notes,
            notes_service::list_folders,
            notes_service::read_note,
            notes_service::write_note,
            notes_service::create_note,
            notes_service::create_folder,
            notes_service::write_image_asset,
            notes_service::rename_note,
            notes_service::delete_note,
            notes_service::rename_folder,
            notes_service::delete_folder,
            notes_service::list_folder_contents,
            notes_service::get_folder_stats,
            settings_service::get_setting,
            settings_service::set_setting,
            vault_settings_service::get_vault_setting,
            vault_settings_service::set_vault_setting
        ])
        .register_uri_scheme_protocol("jotter-asset", |ctx, req| {
            storage::handle_asset_request(ctx.app_handle(), req)
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
