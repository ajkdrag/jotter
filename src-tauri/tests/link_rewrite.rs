use crate::features::search::link_parser::{
    compute_relative_path, format_markdown_link_href, format_wiki_target, rewrite_links,
};
use std::collections::HashMap;

#[test]
fn compute_relative_path_sibling() {
    assert_eq!(compute_relative_path("docs", "docs/target"), "target");
}

#[test]
fn compute_relative_path_nested() {
    assert_eq!(
        compute_relative_path("docs", "docs/sub/target"),
        "./sub/target"
    );
}

#[test]
fn compute_relative_path_up() {
    assert_eq!(
        compute_relative_path("docs/sub", "docs/target"),
        "../target"
    );
}

#[test]
fn compute_relative_path_different_tree() {
    assert_eq!(
        compute_relative_path("docs/sub", "other/target"),
        "../../other/target"
    );
}

#[test]
fn compute_relative_path_from_root() {
    assert_eq!(compute_relative_path("", "docs/target"), "./docs/target");
}

#[test]
fn format_wiki_target_sibling() {
    assert_eq!(
        format_wiki_target("docs/source.md", "docs/target.md"),
        "target"
    );
}

#[test]
fn format_wiki_target_cross_folder() {
    assert_eq!(
        format_wiki_target("docs/source.md", "other/target.md"),
        "../other/target"
    );
}

#[test]
fn format_wiki_target_from_root() {
    assert_eq!(
        format_wiki_target("source.md", "docs/target.md"),
        "docs/target"
    );
}

#[test]
fn format_md_href_sibling() {
    assert_eq!(
        format_markdown_link_href("docs/source.md", "docs/target.md"),
        "target.md"
    );
}

#[test]
fn format_md_href_cross_folder() {
    assert_eq!(
        format_markdown_link_href("docs/source.md", "other/target.md"),
        "../other/target.md"
    );
}

#[test]
fn rewrite_markdown_link() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links("[label](old.md)", "docs/source.md", "docs/source.md", &map);
    assert!(result.changed);
    assert_eq!(result.markdown, "[label](new.md)");
}

#[test]
fn rewrite_wiki_link() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links("[[old]]", "docs/source.md", "docs/source.md", &map);
    assert!(result.changed);
    assert_eq!(result.markdown, "[[new]]");
}

#[test]
fn rewrite_wiki_link_preserves_label() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links("[[old|Custom Label]]", "docs/source.md", "docs/source.md", &map);
    assert!(result.changed);
    assert_eq!(result.markdown, "[[new|Custom Label]]");
}

#[test]
fn rewrite_wiki_link_with_subpath() {
    let mut map = HashMap::new();
    map.insert("docs/sub/old.md".into(), "docs/sub/new.md".into());
    let result = rewrite_links("[[sub/old]]", "docs/source.md", "docs/source.md", &map);
    assert!(result.changed);
    assert_eq!(result.markdown, "[[./sub/new]]");
}

#[test]
fn skip_code_block() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let md = "```\n[[old]]\n```";
    let result = rewrite_links(md, "docs/source.md", "docs/source.md", &map);
    assert!(!result.changed);
}

#[test]
fn skip_inline_code() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links("`[[old]]`", "docs/source.md", "docs/source.md", &map);
    assert!(!result.changed);
}

#[test]
fn skip_image_embed() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links("![[old]]", "docs/source.md", "docs/source.md", &map);
    assert!(!result.changed);
}

#[test]
fn skip_external_url() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links(
        "[label](https://example.com/old.md)",
        "docs/source.md",
        "docs/source.md",
        &map,
    );
    assert!(!result.changed);
}

#[test]
fn rewrite_only_matching_links() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "docs/new.md".into());
    let result = rewrite_links(
        "[[old]] and [[other]] and [md](old.md)",
        "docs/source.md",
        "docs/source.md",
        &map,
    );
    assert!(result.changed);
    assert_eq!(
        result.markdown,
        "[[new]] and [[other]] and [md](new.md)"
    );
}

#[test]
fn rewrite_batch_targets() {
    let mut map = HashMap::new();
    map.insert("docs/a.md".into(), "archive/a.md".into());
    map.insert("docs/b.md".into(), "archive/b.md".into());
    let result = rewrite_links("[[a]] and [[b]]", "docs/source.md", "docs/source.md", &map);
    assert!(result.changed);
    assert_eq!(
        result.markdown,
        "[[../archive/a]] and [[../archive/b]]"
    );
}

#[test]
fn rewrite_outbound_identity_fallback() {
    let map = HashMap::new();
    let result = rewrite_links(
        "[[sibling]]",
        "docs/source.md",
        "archive/source.md",
        &map,
    );
    assert!(result.changed);
    assert_eq!(result.markdown, "[[../docs/sibling]]");
}

#[test]
fn no_change_when_nothing_matches() {
    let map = HashMap::new();
    let result = rewrite_links(
        "[[unrelated]] and [text](other.md)",
        "docs/source.md",
        "docs/source.md",
        &map,
    );
    assert!(!result.changed);
}

#[test]
fn rewrite_markdown_link_parent_relative() {
    let mut map = HashMap::new();
    map.insert("docs/old.md".into(), "notes/new.md".into());
    let result = rewrite_links(
        "[Old](../old.md)",
        "docs/sub/source.md",
        "docs/sub/source.md",
        &map,
    );
    assert!(result.changed);
    assert_eq!(result.markdown, "[Old](../../notes/new.md)");
}

#[test]
fn outbound_markdown_link_source_moved() {
    let map = HashMap::new();
    let result = rewrite_links(
        "[label](sibling.md)",
        "docs/source.md",
        "archive/source.md",
        &map,
    );
    assert!(result.changed);
    assert_eq!(result.markdown, "[label](../docs/sibling.md)");
}
