# Testing Strategy

> Extended testing context for AI agents. Referenced from AGENTS.md.
> **The TDD mandate (tests before implementation) is enforced in AGENTS.md and verified by Sentinel.**
> This document covers the details of HOW to test.

---

## Test Types

| Type | Purpose | Location | Runner |
|------|---------|----------|--------|
| Unit | Core logic, pure functions, isolated components | `tests/unit/` or `*.test.ts` | Vitest |
| Integration | Cross-component interactions, DOM manipulation | `tests/integration/` | Vitest |
| E2E | Critical user flows end-to-end | `tests/e2e/` | Playwright |

## Coverage Requirements

- **New code**: 80% diff coverage required (lines added/modified in the PR)
- **Project-wide coverage**: must never decrease from the previous merge baseline
- **Critical paths**: 100% coverage required (`^gn` injection, textarea targeting, metadata hiding, diff highlighting, thread colorization, repo settings, opt-in banner)
- **Run coverage**: `pnpm test --coverage`
- **Sentinel verifies coverage thresholds on every PR**

## Test-Only PRs

PRs that only add tests to existing (untested) code use commit type `test(scope)` and are exempt from test-first choreography ordering (there is no `feat`/`fix` to follow). Sentinel verifies the tests are meaningful and pass.

## Testing Patterns

### Mocking

Use Vitest's built-in mocking (`vi.mock`, `vi.fn`, `vi.stubGlobal`) for dependency isolation.

```typescript
// DOM stubbing with vi.stubGlobal
const mockQuerySelector = vi.fn();
vi.stubGlobal('document', {
  querySelector: mockQuerySelector,
  querySelectorAll: vi.fn().mockReturnValue([]),
});

// Chrome extension API mocking
const mockChromeStorage = {
  local: { get: vi.fn(), set: vi.fn() },
};
vi.stubGlobal('chrome', { storage: mockChromeStorage });

// Drive behavior with targeted implementations
mockQuerySelector.mockReturnValueOnce(
  createMockTextarea('existing comment text')
);
mockChromeStorage.local.get.mockResolvedValueOnce({
  enabledRepos: ['owner/repo'],
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

## Manual Test Plan: PR Diff Textarea Targeting & Highlighting

These manual tests verify `^gn` metadata injection, highlighting, and
comment-thread color association on the PR "Files Changed" page.
Run them after any change to `textarea-target.ts`, `highlighter.ts`,
`comment-scanner.ts`, or the mouseup handler in `index.ts`.

### Prerequisites
1. Load the extension in Chrome/Edge (developer mode)
2. Open a PR with multiple changed lines (≥ 30 lines)
3. Enable the repo in Gitnotate

### Textarea Targeting

| # | Steps | Expected Result | Status |
|---|-------|-----------------|--------|
| **MT-1** Single comment box | 1. Click "+" on line X to open a comment form  2. Select text on line X | `^gn` metadata appears in line X's textarea | ✅ Passed |
| **MT-2** Two comment boxes | 1. Open form on line X, select text → metadata injected  2. Open form on line Y, select text on line Y | Line Y's textarea gets metadata; line X's is unchanged | ✅ Passed |
| **MT-3** Three comment boxes | 1. Open and inject on line X  2. Open and inject on line Y  3. Open form on line Z, select text on line Z | Each textarea has its own `^gn` metadata; no cross-contamination | ✅ Passed |
| **MT-4** Selection without comment box | 1. Open form on line X, inject metadata  2. Select text on a DISTANT line (no form open there) | Nothing happens — line X's textarea is NOT updated | ✅ Passed |
| **MT-5** Re-select on same line | 1. Open form on line X, select text → metadata injected  2. Select DIFFERENT text on line X | Line X's textarea updates with the new selection's metadata | ✅ Passed |
| **MT-6** Split-view diff | 1. Switch to split-view mode  2. Open form on the right side, select text | Metadata is injected into the correct textarea | ✅ Passed |
| **MT-6b** Open form first then select | 1. Click "+" on line X to open comment form first  2. Then select text on line X | Pending highlight appears on selected text; `^gn` metadata in textarea | ✅ Passed |
| **MT-7** Page re-navigation | 1. Open PR files-changed page  2. Navigate away and back via turbo links  3. Open form, select text | Single injection (no duplicates); metadata goes to correct textarea | ✅ Passed |

### Submitted Comment Highlighting

| # | Steps | Expected Result | Status |
|---|-------|-----------------|--------|
| **MT-8** Single submitted highlight | 1. Select text, inject metadata  2. Click "Comment" to submit | After submission, the selected text is highlighted in the diff | ✅ Passed |
| **MT-9** Multiple submitted highlights | 1. Submit 2 comments on different lines | Both lines show highlights; each with a different color | ✅ Passed |
| **MT-10** Metadata hidden in submitted comment | 1. Submit a comment with `^gn` metadata | The `^gn:...` tag is hidden from the rendered comment body | ✅ Passed |
| **MT-11** Metadata preserved in edit | 1. Submit a comment  2. Click "Edit" on the comment | The `^gn:...` tag is visible in the edit textarea | ✅ Passed |
| **MT-12** Metadata NOT hidden in pending textarea | 1. Open comment form, select text | `^gn:...` tag remains visible in the textarea (not hidden) | ✅ Passed |

### Color Association

| # | Steps | Expected Result | Status |
|---|-------|-----------------|--------|
| **MT-13** Submitted comment color | 1. Submit 2 comments on different lines | Each comment thread has a colored left border + author name matching its highlight color | ✅ Passed |
| **MT-14** Multiple highlights same line | 1. Submit 2 comments on the same line (different text ranges) | Each highlight has a distinct color; each comment thread matches its highlight | ✅ Passed |
| **MT-15** Pending comment box color | 1. Open a comment form on a line with a pending `^gn` selection | The "Add a comment on line" heading matches the highlight color | ✅ Passed |

### Per-Repo Opt-In / Opt-Out

| # | Steps | Expected Result | Status |
|---|-------|-----------------|--------|
| **MT-16** Enable via banner | 1. Visit a PR on a new repo  2. Click "Enable" on the banner | Banner disappears; Gitnotate activates; repo appears in popup "Enabled" list | ✅ Passed |
| **MT-17** Dismiss via "Not now" | 1. Visit a PR on a new repo  2. Click "Not now" | Banner disappears; banner reappears on next visit | ✅ Passed |
| **MT-18** Block via "Never" | 1. Visit a PR on a new repo  2. Click "Never" | Banner disappears; banner does NOT reappear on subsequent visits | |
| **MT-19** Blocked repo skips banner | 1. Block a repo via "Never"  2. Navigate away and return to the PR | No banner shown; no Gitnotate features activated | |
| **MT-20** Popup shows enabled repos | 1. Enable 2 repos  2. Open extension popup | Both repos listed under "Enabled Repositories" | |
| **MT-21** Popup disable repo | 1. Open popup  2. Click "Disable" on an enabled repo  3. Visit that repo's PR | Repo removed from enabled list; banner shows again on next PR visit | |
| **MT-22** Popup shows blocked repos | 1. Block 2 repos via "Never"  2. Open extension popup | Both repos listed under "Blocked Repositories" | |
| **MT-23** Popup unblock repo | 1. Open popup  2. Click "Unblock" on a blocked repo  3. Visit that repo's PR | Repo removed from blocked list; banner shows again (can enable) | |

### Debug Logging

| # | Steps | Expected Result | Status |
|---|-------|-----------------|--------|
| **MT-24** Logs suppressed by default | 1. Open PR with Gitnotate enabled  2. Check console | No `[Gitnotate]` log messages visible | ✅ Passed |
| **MT-25** Enable debug mode | 1. Run `localStorage.setItem('gitnotate-debug', 'true')` in console  2. Reload page | All `[Gitnotate]` debug messages appear in console | |
| **MT-26** Disable debug mode | 1. Run `localStorage.removeItem('gitnotate-debug')`  2. Reload | Debug messages suppressed again | |
