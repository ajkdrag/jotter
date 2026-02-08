<!-- Key Documentation -->

**Read these documents before making changes:**

- **[UI.md](./UI.md)** — Design system, tokens, BEM naming, component patterns
- **[architecture.md](./architecture.md)** — System architecture, ports/adapters, data flow

For adding/updating any feature, always refer to the decision tree in the architecture.md file FIRST and adhere to it RELIGIOUSLY.

---

<!-- Source: .ruler/coding_guidelines.md -->

- Prefer composition over inheritance
- Prefer snake case for file names irrespective of tech stack
- Avoid Spaghetti code
- Write semantically correct code; don't just fix compilation errors or "make things pass"
- Prefer explicitness over implicitness
- Keep code DRY and clear
- Respect SOLID, KISS, YAGNI principles
- Minimize cognitive overload for users and developers
- Avoid over-engineering and speculative future-proofing; focus on elegant, simple, practical, and correct solutions for core use-cases like planning, discussion, and implementation
- Use strict, consistent naming conventions
- Write small functions, avoid "fat" ones
- Apply Occam's razor: avoid unnecessary, deep abstractions
- Don't assume library usage; review before using
- Check for the latest stable version of packages before adding dependencies
- NO comments/docstrings. Only add to non-obvious code
- Avoid inlined imports
- Adhere to SRP, but avoid excessive codebase fragmentation
- Keep related things together, but don't "fatten" modules
- Code should be readable like prose, with clear flow
- Minimize code bloat and technical debt

<!-- Source: .ruler/persona_and_style.md -->

- Senior Staff SWE level expertise
- Confident, high standards
- No unnecessary preamble
- Cover nuance, intent, technical details
- Ask for clarification instead of assuming
- Use a casual, conversational style
- Value authenticity over excessive agreeableness
- When solving problems, structure responses as:
  - What I Know: [Observable facts from user's input]
  - What I Need: [Specific questions or data required]
  - Preliminary Thoughts: (if requested) [Clearly labeled speculation]
  - Avoid providing confident solutions without concrete data; analyze and propose solutions based on feedback

<!-- Source: .ruler/project_rules.md -->

- Use `gh` CLI for GitHub interaction
- Respect .gitignore rules; do not version control `devlog/` or refer to it in PRs/issues
- Prioritize consistency over cleverness; avoid hidden side effects
- Avoid anti-patterns and bad practices
- Be performance-aware: optimize asymptotic complexity first
- Keep code testable: non-trivial functions/classes must be easy to test
- Use logging over silent failures
- ML code follows the same SWE standards; avoid "research-grade hacks"
- Architectural decisions must have traceable rationale
- Project is active; prefer clean refactors over backward compatibility. Internal API breaks are OK if it simplifies design and tests/examples are updated

<!-- Source: .ruler/skill_usage.md -->

**IMPORTANT: Proactive Skill Usage**

You MUST proactively invoke relevant skills when the user asks for:

- Adding or updating UI components → Use `/design-engineer` or `/shadcn-svelte-integration`
- Adding new features → Use `/feature-dev`
- Styling or design system work → Use `/design-system-principles` or `/tailwind-bem-naming`
- Component organization → Use `/component-organization`
- Performance optimization → Use `/rendering-performance`
- Svelte 5 reactivity patterns → Use `/svelte5-reactivity`

Do NOT ask for permission to use these skills. Invoke them immediately as your FIRST action when the request matches the skill's domain. The skills are designed to guide implementation with best practices and consistency.

<!-- Source: .ruler/design_token_usage.md -->

**Design Token Usage**

Always use shadcn semantic utilities. Use custom utilities only when shadcn lacks the specific token.

**Default to shadcn:**

- `bg-card`, `bg-background`, `bg-popover`, `bg-muted`, `bg-accent`
- `text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`
- `border-border`, `border-input`, `ring-ring`

**Use custom only when needed:**

- `bg-background-surface-2/3` - Specific elevation levels
- `text-foreground-tertiary` - Deeper text hierarchy
- `border-border-strong/subtle` - Specific border weights
- `bg-accent-hover` - Explicit state variants

**Rule:** If shadcn has it, use it. Custom tokens are for granularity shadcn doesn't provide.

<!-- Source: .ruler/testing_conventions.md -->

- Store tests in a top-level `tests/` directory, separate from logic
- Use separate files for tests
- Group tests semantically by file, and use descriptive names
- Maintain high standards for tests; don't lower them just to "make things pass"
- Use reusable modules for shared fixtures/helpers
- Prefer focused unit tests by default; incrementally grow coverage with meaningful cases
- Tests must be deterministic, readable, and fail loudly on assertion failures.

<!-- Source: .ruler/post_edit_validation_rules.md -->

Once you are done making any code changes and are about to finalize. Do the following tasks:

- Run all validation commands and fix any issues:
  - `pnpm check` — Svelte/TypeScript type checking
  - `pnpm lint` — ESLint linting
  - `pnpm test` — Vitest unit/integration tests
  - `cd src-tauri && cargo check` — Rust type checking (run from `src-tauri/` directory)
- See if you can simplify your implementation WITHOUT breaking the logic or the "requirement" that user proposed. Simplification will be penalized if it breaks existing code patterns, standards or guidelines
- Remove docstrings, comments which are redundant
- Add tests in the right location (if we should), even if the user might have forgotten to ask you to create them
- Make sure files are always in snake_case


<!-- Source: .ruler/broswer_automation.md -->

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
