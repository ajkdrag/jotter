<img src="./assets/logo.png" alt="Jotter" width="150">

# Jotter

A local-first markdown vault for your notes. No cloud, no accounts, no sync — just your files on your machine.

<p>
  <img src="./assets/editor-screenshot.png" style="width: 49%; display: inline-block;">
  <img src="./assets/editor-screenshot-light.png" style="width: 49%; display: inline-block;">
</p>

## Quickstart

You'll need [Node.js 20+](https://nodejs.org/), [pnpm](https://pnpm.io/), and a [Rust toolchain](https://rustup.rs/).

```bash
pnpm install
pnpm tauri dev
```

That's it. The app opens, you pick or create a vault (any folder on disk), and start writing.

## What it does

- **Vault-based organization** — each vault is just a folder of markdown files. No proprietary formats.
- **Rich markdown editing** — headings, lists, tables, task lists, code blocks with syntax highlighting. Powered by Milkdown/ProseMirror.
- **Full-text search** — backed by Tantivy (same engine family as Lucene, but in Rust). Searches across all notes in a vault instantly.
- **Wiki-style links** — use `[[note-name]]` to link between notes. Backlinks and outlinks are tracked automatically.
- **File tree + command palette** — navigate notes visually or hit `Cmd+K` to jump anywhere.
- **Image support** — paste images directly into notes. Assets are stored alongside your markdown.
- **Dark and light themes** — switch from the editor toolbar.
- **Keyboard-driven** — most actions have shortcuts. Status bar shows cursor position and document stats.

## Stack

| Layer    | Tech                            |
| -------- | ------------------------------- |
| Desktop  | Tauri 2 (Rust)                  |
| Frontend | Svelte 5, SvelteKit, TypeScript |
| Editor   | Milkdown (ProseMirror)          |
| Styling  | Tailwind CSS 4, shadcn-svelte   |
| Search   | Tantivy (Rust)                  |
| State    | XState 5, Svelte runes          |

## Project structure

```
src/               Frontend (Svelte/TS)
  lib/
    ports/         Interface contracts
    adapters/      Platform implementations (web, tauri, editor)
    use_cases/     Business IO (returns domain events)
    commands/      Command schema + command handlers
    stores/        Global state (Svelte 5 runes)
    flows/         State machines (XState)
    runtime/       Runtime context + UI effects
    components/    Presentational UI
src-tauri/         Backend (Rust)
  src/
    notes_service  Note CRUD
    vault_service  Vault management
    index_service  Full-text search (Tantivy)
    assets_service Asset handling
tests/             Unit and integration tests
```

Architecture follows a hexagonal (ports/adapters) pattern. See [architecture.md](./architecture.md) for the full breakdown.

## Development

```bash
pnpm dev             # frontend dev server only
pnpm tauri dev       # full app (frontend + Rust backend)
pnpm build           # build frontend
pnpm tauri build     # build distributable
```

### Validation

Run all of these before submitting changes:

```bash
pnpm check           # Svelte/TypeScript type checking
pnpm lint            # oxlint
pnpm format:check    # Prettier (fails if files need formatting)
pnpm format          # Prettier (writes formatting)
pnpm test            # Vitest
cd src-tauri && cargo check  # Rust type checking
```

For CI: run `pnpm format:check` in a job; it exits non-zero when any file is not formatted. Optionally run `pnpm format` in a separate job and commit the result, or require branches to pass `format:check` before merge.

### Tests

Tests live in the top-level `tests/` directory, not alongside source files. Run with `pnpm test` or `pnpm test:watch` for watch mode.

## Contributing

The codebase is opinionated. A few things worth knowing before jumping in:

- Files are always `snake_case`.
- Business IO goes in `use_cases/`. UI components read stores and dispatch commands.
- Every user-facing flow is modeled as an XState machine in `flows/`.
- See [UI.md](./UI.md) for the design system, tokens, and BEM naming conventions.
- See [architecture.md](./architecture.md) for data flow and layering rules.
