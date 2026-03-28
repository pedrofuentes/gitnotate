# Testing Strategy

> Extended testing context for AI agents. Referenced from AGENTS.md.
> **The TDD mandate (tests before implementation) is enforced in AGENTS.md and verified by Sentinel.**
> This document covers the details of HOW to test.

---

## Test Types

| Type | Purpose | Location | Runner |
|------|---------|----------|--------|
| Unit | Core logic, pure functions, isolated components | `tests/unit/` or `*.test.ts` | Vitest |
| Integration | Cross-component interactions, API calls, DOM manipulation | `tests/integration/` | Vitest |
| E2E | Critical user flows end-to-end | `tests/e2e/` | Playwright |

## Coverage Requirements

- **New code**: 80% coverage required
- **Critical paths**: 100% coverage required (auth, comment creation, anchor resolution)
- **Run coverage**: `pnpm test --coverage`
- **Sentinel verifies coverage thresholds on every PR**

## Testing Patterns

### Mocking

Use Vitest's built-in mocking (`vi.mock`, `vi.fn`, `vi.stubGlobal`) for dependency isolation.

```typescript
// Module mocking with vi.mock
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Global API stubbing with vi.stubGlobal
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Typed mock access with vi.mocked
import { exec } from 'child_process';
const mockExec = vi.mocked(exec);

// Drive behavior with targeted implementations
mockExec.mockImplementationOnce(simulateExec('main\n') as any);
mockFetch.mockResolvedValueOnce({
  ok: false,
  status: 500,
  json: async () => ({ message: 'Internal Server Error' }),
});
```

### Test Naming Convention
```
describe('ModuleName', () => {
  it('should expected behavior when condition', () => {
    // Arrange → Act → Assert
  });
});
```

### What Must Be Tested
- All public API functions
- Error paths and edge cases (not just happy paths)
- State transitions
- Input validation and boundary conditions

### What Should NOT Be Tested
- Framework internals
- Third-party library behavior
- Implementation details (test behavior, not structure)

## CI Integration

- Tests run automatically on every PR via GitHub Actions
- All tests must pass before Sentinel review begins
- Flaky tests must be fixed immediately, not skipped

## Manual Test Plan: PR Diff Textarea Targeting

These manual tests verify that `@gn` metadata injection targets the correct
comment textarea on the PR "Files Changed" page.  Run them after any change
to `textarea-target.ts` or the mouseup handler in `index.ts`.

### Prerequisites
1. Load the extension in Chrome/Edge (developer mode)
2. Open a PR with multiple changed lines (≥ 30 lines)
3. Enable the repo in Gitnotate

### Test Cases

| # | Steps | Expected Result |
|---|-------|-----------------|
| **MT-1** Single comment box | 1. Click "+" on line X to open a comment form  2. Select text on line X | `@gn` metadata appears in line X's textarea |
| **MT-2** Two comment boxes | 1. Open comment form on line X, select text → metadata injected  2. Open comment form on line Y, select text on line Y | Line Y's textarea gets metadata; line X's textarea is unchanged |
| **MT-3** Three comment boxes | 1. Open and inject on line X  2. Open and inject on line Y  3. Open comment form on line Z, select text on line Z | Each textarea has its own `@gn` metadata; no cross-contamination |
| **MT-4** Selection without comment box | 1. Open comment form on line X, inject metadata  2. Select text on a DISTANT line (no comment form open there) | Nothing happens — line X's textarea is NOT updated |
| **MT-5** Re-select on same line | 1. Open comment form on line X, select text → metadata injected  2. Select DIFFERENT text on line X | Line X's textarea updates with the new selection's metadata |
| **MT-6** Split-view diff | 1. Switch to split-view mode  2. Open comment form on the right side, select text | Metadata is injected into the correct textarea |
| **MT-7** Page re-navigation | 1. Open PR files-changed page (Gitnotate initialises)  2. Navigate away and back via turbo links  3. Open comment form, select text | Single injection (no duplicates in console); metadata goes to correct textarea |
