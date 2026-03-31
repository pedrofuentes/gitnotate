# Gitnotate VSCode Extension — Manual Test Plan

> **Scope**: Phase 1.5, Increment 2 (Comment Controller & Thread Sync)
> **Updated**: 2026-03-31
> **Depends on**: Increment 1 test plan (`TEST_PLAN_VSCODE_1.5_1.md`) — suites 1–8 still apply
> **Branch**: `feature/comment-controller-thread-sync`

---

## What's New in Increment 2

- **Comment threads** replace custom decorations — `^gn` PR comments render as native VSCode comment threads via the Comments API
- **Sub-line ranges** — threads highlight the exact character range (not the full line)
- **Reply threading** — replies grouped under parent comments via `in_reply_to_id`
- **CommentingRangeProvider** — gutter `+` button on non-empty markdown lines
- **Debounced editor sync** — switching editors triggers comment refresh after 300ms
- **PrService** (renamed from `github-api.ts`) — extended response with `id`, `side`, `userLogin`, pagination
- **Removed**: `decoration-manager.ts`, `comment-decoration.ts` (no more yellow highlight decorations)

---

## Prerequisites

Same as Increment 1 (see `TEST_PLAN_VSCODE.md`), plus:

- **A PR with `^gn` comments**: You need at least one PR review comment containing `^gn:LINE:SIDE:START:END` metadata. The easiest way:
  1. Open a PR on GitHub in a browser with the Gitnotate browser extension installed
  2. Use the browser extension to add a sub-line comment on a markdown file
  3. Or manually post a review comment with this format:
     ```
     ^gn:5:R:10:25
     > 📌 **"some selected text"** (chars 10–25)

     This is my comment about the selected text.
     ```

---

## Test Suite 9: Comment Thread Display

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9.1 | `^gn` comments render as threads | Sign in to GitHub. Open a repo on a PR branch. Open a markdown file that has `^gn` review comments on the PR. | After ~300ms, comment threads appear in the editor gutter. Each `^gn` comment shows as a native VSCode comment thread with the author name and comment body. Debug Console: `[Gitnotate] Auth token: present` then PR detection logs. | |
| 9.2 | Sub-line range highlighting | Open a file with a `^gn:10:R:5:20` comment (chars 5–20 on line 10). | The comment thread marker appears at line 10. When expanded, the thread highlights characters 5–20 (not the full line). The range corresponds to `^gn` metadata `start:end`. | |
| 9.3 | Comment body displayed | Expand a `^gn` comment thread. | Shows the comment text. The `^gn:...` metadata tag is NOT visible in the body. The `> 📌 "quoted text"` blockquote IS visible (human-readable fallback). Author name shows the GitHub username. | |
| 9.4 | No threads on non-`^gn` comments | Have regular line-level PR comments (without `^gn` metadata) on the same file. | Gitnotate does NOT create threads for plain line comments. Those are handled by the GH PR extension (if installed). Debug Console should not show parsing activity for non-`^gn` comments. | |
| 9.5 | No threads on other files | Open a markdown file that has NO `^gn` comments on the PR. | No comment threads appear. No errors. | |
| 9.6 | Multiple threads on same file | Have 2+ `^gn` comments on different lines of the same file. | Each comment renders as a separate thread at the correct line and character range. | |
| 9.7 | Unknown author fallback | Post a `^gn` comment via a bot or deleted account (rare). | Thread shows author as "unknown" instead of crashing. | ⏭️ Covered by unit test |

---

## Test Suite 10: Reply Threading

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 10.1 | Replies grouped under parent | Have a `^gn` comment with 1+ replies on GitHub. Open the file. | The thread shows the parent comment first, followed by replies in chronological order. Each reply shows its own author. | |
| 10.2 | Reply without `^gn` metadata | Reply to a `^gn` comment on GitHub (the reply won't have `^gn` metadata). | The reply body appears as-is (no parsing). It's grouped correctly under the parent thread. | |
| 10.3 | Multiple reply chains | Have two separate `^gn` threads, each with replies. | Each thread contains only its own replies — no cross-contamination. | |

---

## Test Suite 11: CommentingRangeProvider (Gutter `+` Button)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 11.1 | Gutter `+` on markdown | Open a markdown file on a PR branch. Hover over the gutter (left of line numbers). | A `+` button appears on non-empty lines. Empty lines and whitespace-only lines do NOT show the `+` button. | |
| 11.2 | No gutter `+` on non-markdown | Open a `.ts`, `.js`, or `.json` file. Hover over the gutter. | No `+` button from Gitnotate appears (GH PR extension may show its own). | |
| 11.3 | Click gutter `+` | Click the `+` button on a markdown line. | A new comment thread input box opens at that line. (Note: posting from the gutter is not yet wired in Increment 2 — this verifies the range provider works.) | |

---

## Test Suite 12: Editor Change Sync (Debounce)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 12.1 | Sync on editor switch | Have `^gn` comments on `file-a.md` and `file-b.md`. Open `file-a.md` → see threads. Switch to `file-b.md`. | After ~300ms, `file-a.md` threads disappear from the Comments panel. `file-b.md` threads appear. | |
| 12.2 | Rapid switching debounced | Quickly switch between 3+ tabs within 300ms. | Only the final tab triggers a sync. No duplicate threads, no errors. Debug Console should show only one sync call (not multiple). | |
| 12.3 | Non-markdown editor ignored | Switch from a markdown file to a `.ts` file. | No sync triggered for the `.ts` file. Existing threads from the markdown file are not affected. | |
| 12.4 | No auth — silent skip | Sign out of GitHub. Switch to a markdown file on a PR branch. | No threads appear. No error message. Debug Console: `[Gitnotate] Auth token: absent`. | |
| 12.5 | No PR — silent skip | Open a repo on `main` (no PR). Switch to a markdown file. | No threads appear. No error. | |

---

## Test Suite 13: Old Decorations Removed

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 13.1 | No yellow highlights | Open a markdown file with `^gn` comments. | No yellow background highlights or underlines appear on text ranges. Comments display ONLY as native comment threads (gutter icons). | |
| 13.2 | No hover-to-see-comment | Hover over text that has a `^gn` comment. | No custom hover tooltip appears (old `DecorationManager` behavior). The comment is visible only via the thread UI. | |

---

## Test Suite 14: PrService & Pagination

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 14.1 | Extended fields in API call | Open a file with `^gn` comments. Check Debug Console. | API call to `GET /repos/.../pulls/.../comments?per_page=100&page=1` is logged. Response processing includes `id`, `side`, `userLogin` fields. | |
| 14.2 | Pagination with many comments | Have a PR with 100+ review comments. Open a file. | Debug Console shows page 1 AND page 2 fetch calls. All comments load correctly. | ⏭️ Difficult to set up manually — covered by unit test |

---

## Test Suite 15: Comments Panel Integration

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 15.1 | Threads in Comments panel | Open a markdown file with `^gn` comments. Open the **Comments** panel (View → Comments or click the Comments icon in the Activity Bar). | Gitnotate threads appear under "Gitnotate Sub-line Comments" heading. Each thread shows file path, line, and comment text. | |
| 15.2 | Click-to-navigate | In the Comments panel, click a Gitnotate thread. | Editor scrolls to the exact line and highlights the sub-line range. | |
| 15.3 | Coexistence with GH PR comments | Have both `^gn` comments and regular PR comments. Install GH PR extension. Open Comments panel. | Both "GitHub Pull Requests" and "Gitnotate Sub-line Comments" sections appear. No conflicts or duplicate threads. | |

---

## Test Suite 16: Error Handling & Edge Cases

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 16.1 | Network failure during sync | Disconnect network. Switch to a markdown file on a PR branch. | No crash. No threads appear. Debug Console: `[Gitnotate] listReviewComments failed:` with error. | |
| 16.2 | Malformed `^gn` metadata | Post a PR comment with invalid metadata (e.g., `^gn:abc:X:not:valid`). | Comment is silently skipped. Other valid `^gn` comments still render. No crash. | ⏭️ Covered by unit test |
| 16.3 | Deactivation cleanup | Run tests, then close the Extension Development Host window. | No errors on shutdown. All threads disposed. Debug Console: `[Gitnotate] Extension deactivating...` | |

---

## Known Limitations (Phase 1.5 Increment 2)

These are **not bugs** — documented for Increment 3+:

- **Cache does not persist across tab switches**: `PrService` and `CommentThreadSync` are instantiated per-invocation, so the cache resets each time. Every editor switch triggers a fresh API call. (Tracked: [#11](https://github.com/pedrofuentes/gitnotate/issues/11), planned for Increment 3)
- **No pagination upper bound**: The pagination loop has no `MAX_PAGES` safety limit. (Tracked: [#13](https://github.com/pedrofuentes/gitnotate/issues/13))
- **GitService instantiated per-sync**: Minor object churn on each editor change. (Tracked: [#12](https://github.com/pedrofuentes/gitnotate/issues/12))
- **Side hardcoded to RIGHT**: When posting comments from VSCode, the diff side is always `RIGHT`. Diff-side detection is planned for Increment 5.
- **No reply/resolve from VSCode**: Comment threads are read-only in the Comments panel. Reply and resolve handlers are planned for Increment 5.
- **Gutter `+` creates empty threads**: Clicking the CommentingRangeProvider `+` button opens a thread input, but posting is not yet wired through the Comments API handler (Increment 5).
- **Status bar doesn't auto-refresh**: Same as Increment 1 — PR detection is activation-time only.
- **`^gn` blockquote in thread body**: The human-readable `> 📌 "quoted text"` line appears in the comment thread body. This is intentional for now but could be stripped in a future UX polish pass.

---

## Automated Test Coverage

Increment 2 has **126 automated tests** across 12 test files:

| Module | Tests | Coverage |
|--------|-------|----------|
| `comment-controller.ts` | 9 | 100% stmts, 100% branches, 100% functions |
| `comment-thread-sync.ts` | 10 | 100% stmts, 94.7% branches, 100% functions |
| `pr-service.ts` | 14 | 89.3% stmts, 65.5% branches, 100% functions |
| `extension.ts` | 16 | 100% stmts, 96.3% branches, 100% functions |
| `utils.ts` (debounce) | 6 | 100% all |
| _Other modules_ | 71 | _Unchanged from Increment 1_ |
| **Total** | **126** | **97.56% stmts, 90.74% branches, 100% functions** |

The manual tests above focus on integration behavior that cannot be verified by unit tests alone — real GitHub API responses, VSCode UI rendering, Comments panel layout, and cross-extension coexistence.
