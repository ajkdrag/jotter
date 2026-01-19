# Testing Guide

This directory contains all tests for the imdown application. We follow a pattern of storing tests separately from implementation code.

## Running Tests

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Run tests in watch mode
pnpm check         # Run TypeScript checks
```

## Test Structure

- `tests/` - All test files
  - `helpers/` - Reusable test utilities and mocks
  - `workflows/` - Tests for workflow logic
  - `*.test.ts` - Unit tests for specific modules

## Mock Ports

Use `tests/helpers/mock_ports.ts` for testing workflows and operations that depend on ports:

```typescript
import { create_mock_ports } from '../helpers/mock_ports'

const mock_ports = create_mock_ports()

mock_ports.vault._mock_vaults = [{ id: '...', name: '...', path: '...', created_at: 0 }]
mock_ports.notes._mock_notes.set(vault_id, [{ id: '...', ... }])

await mock_ports.navigation._calls.navigate_to_home
```

## Test Conventions

- Tests are focused and deterministic
- Mock external dependencies (ports, adapters)
- Test business logic, not implementation details
- Use descriptive test names that explain what's being tested
- Group related tests in describe blocks

## Current Coverage

- ✅ Wiki link parsing and resolution
- ✅ Image drop handling
- ✅ Vault workflow navigation
- 🚧 More workflow tests needed
- 🚧 Integration tests needed
