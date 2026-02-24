<img src="./assets/icon.png" alt="Otterly" width="150">

[![Release](https://github.com/ajkdrag/otterly/actions/workflows/release.yml/badge.svg)](https://github.com/ajkdrag/otterly/actions/workflows/release.yml)

# Otterly

A local-first, privacy-focused markdown editor. No accounts, no cloud dependency, no sync fees — just a folder of markdown files you fully own.

<p>
  <img src="./assets/editor-screenshot.png" style="width: 49%; display: inline-block;">
  <img src="./assets/editor-screenshot-light.png" style="width: 49%; display: inline-block;">
</p>

## Why Otterly

Most note-taking apps force a trade-off: either you get polished UX at the cost of cloud lock-in, or you stay local-first but deal with heavy Electron apps that eat your RAM and require constant plugin hunting.

Otterly is built with [Tauri](https://tauri.app/) and [Svelte 5](https://svelte.dev/). It's small, fast, and designed to stay out of your way. Your notes are plain markdown files in a folder you control. If you ever want to stop using Otterly, your notes stay exactly where they are, ready to be opened in any other editor.

## Features

- **Vault-based** — A vault is just a folder. No proprietary database. Use your existing tools (git, sync clients, VS Code) alongside Otterly without issues.
- **Tab system** — Open multiple notes, pin important ones, and restore closed tabs.
- **WYSIWYG Markdown** — Live rendering as you type via Milkdown/ProseMirror. Headings, tables, task lists, and syntax highlighting included.
- **Wiki-links** — Simple `[[note]]` linking. Otterly tracks backlinks and outlinks automatically to help you navigate your knowledge base.
- **The Omnibar** — One search bar for everything. Search notes by content (SQLite FTS5) or quickly jump to files by name (`Cmd+P` / `Cmd+O`).
- **Git Integration** — Native support for versioning. View status, stage changes, and commit without leaving the app.
- **Image Paste** — Paste images directly into the editor. They are automatically stored in an assets folder of your choice.
- **Custom Hotkeys** — Rebindable shortcuts for every action in the app.
- **Dark & Light Modes** — Matches your system or toggle manually.

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- [Rust toolchain](https://rustup.rs/)
- Platform-specific build tools (see [Tauri's guide](https://tauri.app/start/prerequisites/))

### Installation

```bash
pnpm install
pnpm tauri dev
```

To build a production installer for your platform:

```bash
pnpm tauri build
```

## Contributing

We use a Ports and Adapters (Hexagonal) architecture to keep the business logic testable and decoupled from the platform.

- **Business Logic:** Check `src/lib/services/`
- **Architecture Details:** See [architecture.md](./architecture.md)
- **UI & Design System:** See [UI.md](./UI.md)

### Validation

Before submitting a PR, please run:

```bash
pnpm check      # Type checking
pnpm lint       # Linting
pnpm test       # Vitest unit tests
pnpm format     # Prettier
```

## License

MIT - See [LICENSE](./LICENSE) for details.
