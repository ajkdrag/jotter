use crate::features::vault_settings::service::parse_vault_settings;

#[test]
fn parse_vault_settings_accepts_trailing_json_payload() {
    let bytes = br#"{
  "editor_settings": {
    "theme": "system"
  }
}
{
  "stale_payload": true
}
"#;

    let parsed = parse_vault_settings(bytes).expect("expected parse to succeed");
    let editor_settings = parsed
        .get("editor_settings")
        .expect("editor_settings should be present")
        .as_object()
        .expect("editor_settings should be object");
    let theme = editor_settings
        .get("theme")
        .expect("theme key should be present")
        .as_str()
        .expect("theme should be string");

    assert_eq!(theme, "system");
    assert!(!parsed.contains_key("stale_payload"));
}

#[test]
fn parse_vault_settings_rejects_invalid_json() {
    let bytes = br#"{ invalid json }"#;

    let result = parse_vault_settings(bytes);

    assert!(result.is_err());
}
