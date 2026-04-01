# Gitnotate VSCode Extension — Test Plan

> **Scope**: Phase 1.5, Increment 4 (Comments Sidebar — TreeView)
> **Created**: 2026-04-01
> **Depends on**: Increment 3 test plan (`TEST_PLAN_VSCODE_1.5_3.md`) — suites 9–22 still apply
> **Branch**: `feature/comments-sidebar` (merged to `main`)

---

## Trust Level Legend

| Marker | Meaning | Manual check needed? |
|--------|---------|----------------------|
| ✅ Unit | Verified by unit test with meaningful assertions — **high trust** | No |
| 🔍 Integration | Smoke test in real VSCode — proves no crash, not correct behavior | One spot-check per category recommended |
| ⬜ Manual | Cannot be automated — requires real GitHub auth/API or visual UI | Yes, must verify |
| ⏭️ Covered | Impractical to set up manually — fully covered by unit test | No |

---

## What's New in Increment 4

- **Comments Sidebar (TreeView)** — a `gitnotateComments` view in the Gitnotate activity bar showing all PR comments grouped by file.
- **Both comment types** — `^gn` sub-line comments and regular line-level PR comments are displayed.
- **Click-to-navigate** — clicking a comment in the sidebar opens the file at the comment's range.
- **State messages** — loading, no PR, no auth, and no comments states shown when appropriate.
- **Refresh button** — manual refresh via a toolbar button in the view title bar.
- **Context keys** — `gitnotate.hasComments` and `gitnotate.hasPR` for `when` clauses.
- **EventEmitter refresh** — tree updates when comments sync, state changes, or manual refresh is triggered.

---

## Prerequisites

Same as Increment 3 (see `TEST_PLAN_VSCODE_1.5_3.md`), plus:

- **Test repo**: `pedrofuentes/test`, **PR #6** (`feature/edge-case-updates` → `master`)
- **Two markdown files with `^gn` comments on PR #6**:
  - `edge-cases.md` — 5 `^gn` comments + 1 regular line comment with replies
  - `notes.md` — 1 `^gn` comment on line 3, chars 20–57
- **Non-markdown file**: `sample.js` (also in PR #6, for negative tests)
- **Gitnotate sidebar**: The `Gitnotate` icon in the activity bar (pin icon)

---

## Test Suite 23: Sidebar Tree Structure

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 23.1 | Sidebar shows file items | Open the Gitnotate sidebar (click pin icon in activity bar). Open `edge-cases.md` on PR #6. Wait for sync. | Sidebar shows file items grouped by path (e.g., `edge-cases.md`, `notes.md`). Each file item shows a count like "5 comments" or "1 comment". | ⬜ Manual |
| 23.2 | File items are collapsible | Click a file item in the sidebar. | It expands to show individual comment items. Clicking again collapses it. | ⬜ Manual |
| 23.3 | ^gn comments show user body | Expand a file item with `^gn` comments. | Each `^gn` comment shows the user's comment text (not the `^gn:...` metadata line or the `> 📌 "..."` blockquote). Shows author and sub-line range (e.g., `@pedro L10:5-20`). | ⬜ Manual |
| 23.4 | Regular line comments show body | Expand a file item with regular (non-`^gn`) comments. | Regular comments show the full comment body as label. Shows author and line number (e.g., `@maria L15`). | ⬜ Manual |
| 23.5 | Comments sorted by line number | Expand a file item with multiple comments. | Comments are ordered by ascending line number. | ✅ Unit |
| 23.6 | Files sorted alphabetically | Sidebar with comments on multiple files. | File items are sorted alphabetically by path. | ✅ Unit |
| 23.7 | Only root comments shown (not replies) | File item with a root comment that has replies. | Only the root comment appears as a tree item. Reply count shown in description (e.g., `· 2 replies`). | ✅ Unit |
| 23.8 | Long comments truncated | Comment with body longer than 60 characters. | Label is truncated to ~60 chars with `...` suffix. | ✅ Unit |

---

## Test Suite 24: Sidebar State Messages

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 24.1 | Loading state on startup | Open the Gitnotate sidebar immediately after extension activation (before any sync completes). | Sidebar shows "Loading comments..." message item. | ✅ Unit |
| 24.2 | No PR state | Open a markdown file that is NOT on a PR branch (e.g., `main` with no open PR). Open the sidebar. | Sidebar shows "No open PR detected" message. | ⬜ Manual |
| 24.3 | No auth state | Sign out of GitHub. Open the Gitnotate sidebar. | Sidebar shows "Sign in to GitHub" message. | ⬜ Manual |
| 24.4 | No comments state | Open a markdown file on a PR branch that has zero review comments. Open the sidebar. | Sidebar shows "No comments on this PR" message. | ✅ Unit + ⬜ Manual |
| 24.5 | State transitions correctly | Start signed out → sign in → open PR branch → see comments → sign out again. | Sidebar state transitions: "Sign in" → "Loading" → comments tree → "Sign in". | ⬜ Manual |

---

## Test Suite 25: Click-to-Navigate

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 25.1 | Click ^gn comment navigates to sub-line range | In sidebar, click a `^gn` comment item (e.g., `@pedro L10:5-20`). | The file opens (or focuses if already open) and the cursor/selection jumps to line 10, characters 5–20. The comment thread at that range should be visible. | ⬜ Manual |
| 25.2 | Click regular comment navigates to line | In sidebar, click a regular (non-`^gn`) comment item (e.g., `@maria L15`). | The file opens and the cursor jumps to line 15. | ⬜ Manual |
| 25.3 | Click comment on different file | Sidebar shows comments on `edge-cases.md` and `notes.md`. Currently viewing `edge-cases.md`. Click a comment under `notes.md`. | `notes.md` opens and navigates to the comment's line. | ⬜ Manual |
| 25.4 | CommentItem has correct command args | (Unit test) Verify CommentItem command arguments for ^gn vs regular. | ^gn: `[path, line, start, end]`. Regular: `[path, line, undefined, undefined]`. | ✅ Unit |

---

## Test Suite 26: Refresh Button

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 26.1 | Refresh button visible | Open the Gitnotate sidebar. | A refresh icon (↻) appears in the sidebar title bar. | ⬜ Manual |
| 26.2 | Refresh triggers re-sync | Click the refresh button. Check Debug Console. | Debug Console shows `[Gitnotate] Manual refresh triggered` followed by comment sync logs. Sidebar updates with fresh data. | ⬜ Manual |
| 26.3 | Refresh picks up new comments | Add a new comment on the PR via GitHub web UI. Click refresh in sidebar. | The new comment appears in the sidebar tree after refresh. | ⬜ Manual |
| 26.4 | refreshComments command registered | (Unit test) Verify command is registered on activation. | `gitnotate.refreshComments` registered. | ✅ Unit |

---

## Test Suite 27: Context Keys

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 27.1 | hasComments set when comments exist | Open a file on a PR with comments. Wait for sync. | `gitnotate.hasComments` context key is `true`. (Cannot directly verify in UI — affects `when` clauses for menu items.) | ✅ Unit |
| 27.2 | hasComments false when no comments | Open a file on a PR with zero comments. | `gitnotate.hasComments` context key is `false`. | ✅ Unit |
| 27.3 | hasPR set when PR detected | Open a file on a PR branch. | `gitnotate.hasPR` context key is `true`. | ✅ Unit |
| 27.4 | hasPR false when no PR | Open a file not on a PR branch. | `gitnotate.hasPR` context key is `false`. | ✅ Unit |
| 27.5 | Context keys cleared on auth change | Sign out of GitHub while comments are visible. | Both `gitnotate.hasPR` and `gitnotate.hasComments` set to `false`. | ✅ Unit |

---

## Test Suite 28: Sidebar + Sync Integration

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 28.1 | Sidebar updates on editor change | Open `edge-cases.md` (sync happens). Check sidebar. Open `notes.md` (sync happens). Check sidebar. | Sidebar shows all comments from the PR (both files) after each sync. The tree content should be the same regardless of which file is active, since all PR comments are shown. | ⬜ Manual |
| 28.2 | Sidebar clears on sign-out | Have comments visible in sidebar. Sign out of GitHub. | Sidebar changes to "Sign in to GitHub" message. Comments disappear. | ⬜ Manual |
| 28.3 | Sidebar repopulates on sign-in | After signing out (28.2), sign back in. Open a markdown file on the PR branch. | Sidebar transitions from "Sign in" → loading → shows all PR comments. | ⬜ Manual |
| 28.4 | Tree provider updated after sync | (Unit test) Verify sync pipeline calls `treeProvider.setComments()`. | After successful sync, tree provider receives comment data. | ✅ Unit |
| 28.5 | No-auth state set when no token | (Unit test) Verify sync sets noAuth state when no token. | `treeProvider.setState('noAuth')` called. | ✅ Unit |
| 28.6 | No-PR state set when no PR found | (Unit test) Verify sync sets noPr state when no PR detected. | `treeProvider.setState('noPr')` called. | ✅ Unit |

---

## Test Suite 29: Sidebar Smoke Tests (Integration)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 29.1 | Sidebar commands registered on activation | Open a markdown file. Check registered commands. | `gitnotate.refreshComments` and `gitnotate.goToComment` exist in command list. | 🔍 Integration |
| 29.2 | Opening sidebar does not crash | Click the Gitnotate icon in the activity bar. | Sidebar opens without errors. Shows a message item (loading/no PR/no auth). | 🔍 Integration |
| 29.3 | Tab switching with sidebar open doesn't crash | Open sidebar. Open `edge-cases.md`. Switch to `notes.md`. Switch to `sample.js`. Switch back to `edge-cases.md`. | No errors. Sidebar remains functional. | 🔍 Integration |
| 29.4 | Close all + reopen with sidebar open | Open sidebar. Open `edge-cases.md`. Close all editors. Reopen `notes.md`. | No errors. Extension still active. Sidebar shows appropriate state. | 🔍 Integration |

---

## Your Manual Checklist

### ⬜ Must verify (no automation possible)

| # | Test | What to check |
|---|------|---------------|
| 23.1 | Sidebar shows file items | Open sidebar + `edge-cases.md` on PR #6. Verify file items with comment counts appear. |
| 23.2 | File items are collapsible | Click to expand/collapse file items in sidebar. |
| 23.3 | ^gn comments show user body | Expand file item. Verify ^gn comments show user text (not metadata), author, and sub-line range. |
| 23.4 | Regular comments show body | Verify regular comments show full body, author, and line number. |
| 24.2 | No PR state | Open markdown not on PR branch. Sidebar shows "No open PR detected". |
| 24.3 | No auth state | Sign out of GitHub. Sidebar shows "Sign in to GitHub". |
| 24.5 | State transitions | Sign out → sign in → open PR → verify sidebar transitions through states correctly. |
| 25.1 | Click ^gn comment navigates | Click ^gn comment in sidebar → file opens at sub-line range, thread visible. |
| 25.2 | Click regular comment navigates | Click regular comment → file opens at correct line. |
| 25.3 | Cross-file navigation | Click comment on a different file → that file opens at the comment's line. |
| 26.1 | Refresh button visible | Open sidebar. Verify ↻ refresh icon in title bar. |
| 26.2 | Refresh triggers re-sync | Click refresh. Check Debug Console for sync logs. |
| 26.3 | Refresh picks up new comments | Add comment on GitHub web, click refresh, verify it appears. |
| 28.1 | Sidebar shows all PR comments | After sync, sidebar shows comments from ALL files in the PR (not just the active file). |
| 28.2 | Sidebar clears on sign-out | Sign out → sidebar shows "Sign in to GitHub". |
| 28.3 | Sidebar repopulates on sign-in | Sign back in → sidebar shows comments after sync. |

### 🔍 Recommended spot-checks (one per category, first time only)

| Category | Recommended test | What to verify |
|----------|------------------|----------------|
| Sidebar display | 23.1 + 23.3 | Open sidebar with PR. File items + ^gn comments display correctly |
| Navigation | 25.1 | Click ^gn comment → file opens at sub-line range |
| Refresh | 26.2 | Click refresh → Debug Console shows sync logs |
| States | 24.3 + 28.2 | Sign out → sidebar shows "Sign in", sign in → comments reappear |

**Once these 4 spot-checks pass**, the remaining manual tests are variations of the same flows and the integration smoke tests provide crash-safety coverage.

### Summary

| Trust level | Count | Manual effort |
|-------------|-------|---------------|
| ✅ Unit (high trust) | 16 | None |
| 🔍 Integration (smoke) | 4 | 4 spot-checks (first time) |
| ⬜ Manual | 16 | Must verify each |
| **Total** | **36** | **20 manual checks** |

---

## Known Limitations (Phase 1.5 Increment 4)

These are **not bugs** — documented for future increments:

- **Sidebar shows ALL PR comments**: Not filtered by active file — this is intentional (PR-wide view).
- **No bidirectional navigation**: Clicking a comment thread in the editor does not reveal/select it in the sidebar. `createTreeView` returns a `reveal()` method that enables this — planned for Increment 5.
- **No reply/resolve from sidebar**: Comment items are read-only in the sidebar. Reply/resolve planned for Increment 5.
- **goToComment silently fails**: If the file path cannot be resolved, the error is logged to Debug Console but no user-visible feedback is shown. Sentinel follow-up (🟢 MINOR-1).
- **Path uses string concatenation**: `${workspaceRoot}/${filePath}` instead of `vscode.Uri.joinPath`. Works but not idiomatic. Sentinel follow-up (🟢 MINOR-2).
- **Side hardcoded to RIGHT**: Unchanged from Increment 2. Planned for Increment 5.
- **Duplicate threads with GH PR extension**: Unchanged. Deduplication planned for Increment 5.
- **Context keys not testable manually**: `gitnotate.hasPR` and `gitnotate.hasComments` affect `when` clauses but can't be directly inspected by users.
- **treeProvider.dispose() not tested in deactivation**: Sentinel follow-up (🟡 IMPORTANT-2).

---

## Automated Test Coverage

Increment 4 has **210 automated tests** across 13 unit test files + 1 integration test file:

| Module | Tests | Stmts | Branches | Funcs | Lines |
|--------|-------|-------|----------|-------|-------|
| `comments-tree-provider.ts` | 43 (new) | 97.29% | 85% | 100% | 97.29% |
| `extension.ts` | 39 (+7) | 86.02% | 92% | 100% | 86.02% |
| `comment-thread-sync.ts` | 18 | 98.38% | 87.09% | 100% | 98.38% |
| `comment-controller.ts` | 18 | 100% | 100% | 100% | 100% |
| _Other modules_ | 92 | _Unchanged from Increment 3_ | | | |
| **Total unit** | **210** | **87.7%** | **89.02%** | **100%** | **87.7%** |

**Integration tests** (run via `pnpm test:integration`):

| Suite | Tests | Coverage |
|-------|-------|----------|
| Suite 29: Sidebar Smoke Tests | 4 (new) | Sidebar activation, navigation, tab switching |
| _Suites 9–22 (Increments 2–3)_ | 17 | _Unchanged_ |
| **Total integration** | **21** | |
