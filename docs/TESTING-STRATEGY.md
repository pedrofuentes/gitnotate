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
