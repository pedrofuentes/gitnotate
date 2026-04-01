# Gitnotate VSCode Extension — Manual Test Plan

> **Scope**: Phase 1.5, Increment 2 (Comment Controller & Thread Sync)
> **Updated**: 2026-04-01
> **Depends on**: Increment 1 test plan (`TEST_PLAN_VSCODE_1.5_1.md`) — suites 1–8 still apply
> **Branch**: `feature/comment-controller-thread-sync`

---

## What's New in Increment 2

- **Comment threads** replace custom decorations — PR comments render as native VSCode comment threads via the Comments API
- **Sub-line ranges** — `^gn` threads highlight the exact character range with colored wavy underlines
- **6-color palette** — distinct wavy underline colors (yellow, blue, purple, orange, teal, pink) for multiple comments, with matching emoji labels (🟡🔵🟣🟠🟢🔴) on thread comments
- **All PR comments shown** — both `^gn` (sub-line) and regular line-level comments display as threads
- **Reply threading** — replies grouped under parent comments via `in_reply_to_id`
- **Post-comment refresh** — after posting a comment from VSCode, threads and highlights refresh immediately
- **Blockquote stripped** — the `> 📌 "quoted text"` fallback is stripped from `^gn` comment bodies (redundant in VSCode)
- **CommentingRangeProvider** — gutter `+` button on non-empty markdown lines
- **Debounced editor sync** — switching editors triggers comment refresh after 300ms
- **PrService** (renamed from `github-api.ts`) — extended response with `id`, `side`, `userLogin`, pagination
- **Removed**: `decoration-manager.ts`, `comment-decoration.ts` (no more yellow highlight decorations)

---

## Prerequisites

Same as Increment 1 (see `TEST_PLAN_VSCODE_1.5_1.md`), plus:

- **A PR with `^gn` comments**: You need at least one PR review comment containing `^gn:LINE:SIDE:START:END` metadata. The easiest way:
  1. Open a PR on GitHub in a browser with the Gitnotate browser extension installed
  2. Use the browser extension to add a sub-line comment on a markdown file
  3. Or manually post a review comment with this format:
     ```
     ^gn:5:R:10:25
     > 📌 **"some selected text"** (chars 10–25)

     This is my comment about the selected text.
     ```
- **A PR with regular (non-`^gn`) comments**: At least one normal line-level review comment on the same or different file, to test non-`^gn` thread display.

---

## Test Suite 9: Comment Thread Display

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9.1 | `^gn` comments render as threads | Sign in to GitHub. Open a repo on a PR branch. Open a markdown file that has `^gn` review comments on the PR. | After ~300ms, comment threads appear in the editor gutter with colored wavy underlines on the annotated text. Debug Console: `[Gitnotate] Comment sync: syncing <file> (PR #N)` then `[Gitnotate] Thread sync: created N threads (M ^gn + K line)`. | ✅ |
| 9.2 | Sub-line range highlighting | Open a file with a `^gn:10:R:5:20` comment (chars 5–20 on line 10). | The comment thread marker appears at line 10. A colored wavy underline highlights characters 5–20 (not the full line). The range corresponds to `^gn` metadata `start:end`. | ✅ |
| 9.3 | Comment body displayed | Expand a `^gn` comment thread. | Shows only the user's comment text. The `^gn:...` metadata tag and `> 📌 "quoted text"` blockquote are both stripped. Author name shows the GitHub username. | ✅ |
| 9.4 | Non-`^gn` comments shown as line threads | Have regular line-level PR comments (without `^gn` metadata) on the same file. | Regular comments appear as full-line threads (no sub-line range, no wavy underline, no emoji label). Comment body shows the full text as-is. | ✅ |
| 9.5 | No threads on other files | Open a markdown file that has NO PR comments. | No comment threads appear. No errors. | ✅ |
| 9.6 | Multiple threads on same file | Have 2+ `^gn` comments on different lines of the same file. | Each comment renders as a separate thread at the correct line and character range with a distinct colored wavy underline. | ✅ |
| 9.7 | Multi-color on same line | Have 2+ `^gn` comments on the same line targeting different text ranges. | Each underline uses a different color from the palette (yellow → blue → purple → ...). Matching emoji labels appear on the corresponding threads. | ✅ |
| 9.8 | Unknown author fallback | Post a `^gn` comment via a bot or deleted account (rare). | Thread shows author as "unknown" instead of crashing. | ⏭️ Covered by unit test |

---

## Test Suite 10: Reply Threading

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 10.1 | Replies grouped under parent | Have a `^gn` comment with 1+ replies on GitHub. Open the file. | The thread shows the parent comment first, followed by replies in chronological order. Each reply shows its own author. | ✅ |
| 10.2 | Reply without `^gn` metadata | Reply to a `^gn` comment on GitHub (the reply won't have `^gn` metadata). | The reply body appears as-is (no parsing). It's grouped correctly under the parent thread. | ✅ |
| 10.3 | Multiple reply chains | Have two separate `^gn` threads, each with replies. | Each thread contains only its own replies — no cross-contamination. | ✅ |
| 10.4 | Reply on non-`^gn` comment | Reply to a regular line comment on GitHub. Open the file. | The reply appears under the parent line thread. | ✅ |

---

## Test Suite 11: CommentingRangeProvider (Gutter `+` Button)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 11.1 | Gutter `+` on markdown | Open a markdown file on a PR branch. Hover over the gutter (left of line numbers). | A `+` button appears on non-empty lines. Empty lines and whitespace-only lines do NOT show the `+` button. | ⬜ |
| 11.2 | No gutter `+` on non-markdown | Open a `.ts`, `.js`, or `.json` file. Hover over the gutter. | No `+` button from Gitnotate appears (GH PR extension may show its own). | ⬜ |
| 11.3 | Click gutter `+` | Click the `+` button on a markdown line. | A new comment thread input box opens at that line. (Note: posting from the gutter is not yet wired in Increment 2 — this verifies the range provider works.) | ⬜ |

---

## Test Suite 12: Editor Change Sync (Debounce)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 12.1 | Sync on editor switch | Have PR comments on `file-a.md` and `file-b.md`. Open `file-a.md` → see threads. Switch to `file-b.md`. | After ~300ms, `file-a.md` threads disappear from the Comments panel. `file-b.md` threads appear. | ⬜ |
| 12.2 | Rapid switching debounced | Quickly switch between 3+ tabs within 300ms. | Only the final tab triggers a sync. Debug Console shows only one `[Gitnotate] Comment sync: syncing ...` entry (not multiple). | ⬜ |
| 12.3 | Non-markdown editor ignored | Switch from a markdown file to a `.ts` file. | Debug Console: `[Gitnotate] Comment sync: not markdown — skipping`. Existing threads from the markdown file are not affected. | ⬜ |
| 12.4 | No auth — silent skip | Sign out of GitHub. Switch to a markdown file on a PR branch. | No threads appear. No error message. Debug Console: `[Gitnotate] Comment sync: no auth token — skipping`. | ⬜ |
| 12.5 | No PR — silent skip | Open a repo on `main` (no PR). Switch to a markdown file. | No threads appear. No error. Debug Console: `[Gitnotate] Comment sync: no PR found — skipping`. | ⬜ |

---

## Test Suite 13: Post-Comment Refresh & Highlights

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 13.1 | Wavy underlines visible | Open a markdown file with `^gn` comments. | Colored wavy underlines appear on the exact text ranges. No yellow background highlights (old behavior removed). | ⬜ |
| 13.2 | Post-comment refresh | Select text in a markdown file. Run "Gitnotate: Add Comment". Enter comment text. | Comment posts to GitHub. After success, the new comment immediately appears as a thread with a wavy underline — no manual tab switch needed. | ⬜ |
| 13.3 | Color matches between underline and emoji | Open a file with multiple `^gn` comments. | Each thread's emoji label (🟡🔵🟣🟠🟢🔴) matches the color of its wavy underline. | ⬜ |
| 13.4 | No hover-to-see-comment | Hover over text that has a `^gn` comment. | No custom hover tooltip appears (old `DecorationManager` behavior). The comment is visible only via the thread UI. | ⬜ |

---

## Test Suite 14: PrService & Pagination

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 14.1 | Extended fields in API call | Open a file with `^gn` comments. Check Debug Console. | Debug Console: `[Gitnotate] GET https://api.github.com/repos/.../pulls/.../comments?per_page=100&page=1`. Thread sync logs show comments parsed with author names. | ⬜ |
| 14.2 | Pagination with many comments | Have a PR with 100+ review comments. Open a file. | Debug Console shows page 1 AND page 2 fetch calls. All comments load correctly. | ⏭️ Difficult to set up manually — covered by unit test |

---

## Test Suite 15: Comments Panel Integration

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 15.1 | Threads in Comments panel | Open a markdown file with PR comments. Open the **Comments** panel (View → Comments or click the Comments icon in the Activity Bar). | Gitnotate threads appear under "Gitnotate Sub-line Comments" heading. Both `^gn` and regular line threads are listed. | ⬜ |
| 15.2 | Click-to-navigate | In the Comments panel, click a Gitnotate thread. | Editor scrolls to the exact line and highlights the sub-line range. | ⬜ |
| 15.3 | Coexistence with GH PR comments | Have both `^gn` comments and regular PR comments. Install GH PR extension. Open Comments panel. | Both "GitHub Pull Requests" and "Gitnotate Sub-line Comments" sections appear. Regular line comments may appear in both (expected — deduplication planned for Increment 5). | ⬜ |

---

## Test Suite 16: Error Handling & Edge Cases

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 16.1 | Network failure during sync | Disconnect network. Switch to a markdown file on a PR branch. | No crash. No threads appear. Debug Console: `[Gitnotate] listReviewComments failed:` with error. | ⬜ |
| 16.2 | Malformed `^gn` metadata | Post a PR comment with invalid metadata (e.g., `^gn:abc:X:not:valid`). | Comment shows as a regular line thread (not parsed as `^gn`). Other valid `^gn` comments still render. No crash. | ⬜ |
| 16.3 | Deactivation cleanup | Run tests, then close the Extension Development Host window. | No errors on shutdown. All threads disposed. Debug Console: `[Gitnotate] Extension deactivating...` | ⬜ |

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
- **Duplicate threads with GH PR extension**: When both Gitnotate and GH PR extension are active, regular line comments may appear in both. Deduplication planned for Increment 5.

---

## Automated Test Coverage

Increment 2 has **135 automated tests** across 12 test files:

| Module | Tests | Coverage |
|--------|-------|----------|
| `comment-controller.ts` | 18 | 100% stmts, 94.7% branches, 100% functions |
| `comment-thread-sync.ts` | 10 | 100% stmts, 94.7% branches, 100% functions |
| `pr-service.ts` | 14 | 89.4% stmts, 65.5% branches, 100% functions |
| `extension.ts` | 18 | 99.1% stmts, 93.5% branches, 100% functions |
| `utils.ts` (debounce) | 6 | 100% all |
| _Other modules_ | 69 | _Unchanged from Increment 1_ |
| **Total** | **135** | **97.57% stmts, 90.13% branches, 100% functions** |

The manual tests above focus on integration behavior that cannot be verified by unit tests alone — real GitHub API responses, VSCode UI rendering, Comments panel layout, and cross-extension coexistence.
