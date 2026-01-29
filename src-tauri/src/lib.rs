mod notes_service;
mod assets_service;
mod index_service;
mod watcher_service;
mod storage;
mod vault_service;
mod settings_service;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(watcher_service::WatcherState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            vault_service::open_vault,
            vault_service::open_vault_by_id,
            vault_service::list_vaults,
            vault_service::remember_last_vault,
            vault_service::get_last_vault_id,
            watcher_service::watch_vault,
            watcher_service::unwatch_vault,
            assets_service::import_asset,
            index_service::index_build,
            index_service::index_search,
            index_service::index_backlinks,
            index_service::index_outlinks,
            notes_service::list_notes,
            notes_service::read_note,
            notes_service::write_note,
            notes_service::create_note,
            notes_service::rename_note,
            notes_service::delete_note,
            settings_service::get_setting,
            settings_service::set_setting
        ])
        .register_uri_scheme_protocol("imdown-asset", |ctx, req| {
            storage::handle_asset_request(ctx.app_handle(), req)
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
