mod constants;
mod git_service;
mod index_service;
mod notes_service;
mod search_db;
mod settings_service;
mod storage;
mod vault_service;
mod vault_settings_service;
mod watcher_service;

include!(concat!(env!("OUT_DIR"), "/icon_stamp.rs"));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = ICON_STAMP;
    log::info!("Jotter starting");

    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    let mut log_builder = tauri_plugin_log::Builder::new()
        .level(log_level)
        .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                file_name: None,
            }),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
        ]);

    if std::env::var("JOTTER_LOG_FORMAT").as_deref() == Ok("json") {
        log_builder = log_builder.format(|callback, message, record| {
            callback.finish(format_args!(
                r#"{{"level":"{}","target":"{}","message":"{}"}}"#,
                record.level(),
                record.target(),
                message
            ))
        });
    }

    tauri::Builder::default()
        .manage(watcher_service::WatcherState::default())
        .manage(index_service::SearchDbState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(log_builder.build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            vault_service::open_vault,
            vault_service::open_vault_by_id,
            vault_service::list_vaults,
            vault_service::remove_vault_from_registry,
            vault_service::remember_last_vault,
            vault_service::get_last_vault_id,
            watcher_service::watch_vault,
            watcher_service::unwatch_vault,
            index_service::index_build,
            index_service::index_cancel,
            index_service::index_rebuild,
            index_service::index_search,
            index_service::index_suggest,
            index_service::index_suggest_planned,
            index_service::index_upsert_note,
            index_service::index_remove_note,
            index_service::index_remove_notes,
            index_service::index_remove_notes_by_prefix,
            index_service::index_rename_note,
            index_service::index_rename_folder,
            index_service::index_note_links_snapshot,
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
            vault_settings_service::set_vault_setting,
            git_service::git_has_repo,
            git_service::git_init_repo,
            git_service::git_status,
            git_service::git_stage_and_commit,
            git_service::git_log,
            git_service::git_diff,
            git_service::git_show_file_at_commit,
            git_service::git_restore_file,
            git_service::git_create_tag
        ])
        .register_uri_scheme_protocol("jotter-asset", |ctx, req| {
            storage::handle_asset_request(ctx.app_handle(), req)
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
