# Gitnotate VSCode Extension — Manual Test Plan

> **Scope**: Phase 1.5, Increment 3 (Comment Lifecycle & Refresh)
> **Created**: 2026-04-01
> **Depends on**: Increment 2 test plan (`TEST_PLAN_VSCODE_1.5_2.md`) — suites 9–16 still apply
> **Branch**: `feature/hoist-services` (merged to `main`)

---

## What's New in Increment 3

- **Service hoisting** — `PrService` and `CommentThreadSync` are now long-lived module-scope instances that persist across editor changes. The comment cache survives tab switches.
- **Token-change detection** — when the GitHub auth token changes (sign-out/sign-in), services are recreated and the cache is invalidated automatically.
- **Cache-first display** — on editor switch, cached comment threads render instantly, then a background API fetch refreshes them if the data has changed.
- **MAX_PAGES safety bound** — `PrService.listReviewComments` pagination is capped at 10 pages (1,000 comments) to prevent unbounded loops.
- **Save handler** — saving a markdown file triggers a comment re-sync to pick up any line shifts.
- **Close handler** — closing a markdown file tab clears its comment threads from memory.
- **Auth change handler** — changing GitHub auth sessions (sign in/out) invalidates the cache and triggers a re-sync.

---

## Prerequisites

Same as Increment 2 (see `TEST_PLAN_VSCODE_1.5_2.md`), plus:

- **Two markdown files with PR comments**: You need at least two markdown files in the same PR, each with at least one `^gn` review comment, to test cache persistence across tab switches.
- **Test repo**: `pedrofuentes/test` — create any files needed for testing directly there.

---

## Test Suite 17: Cache Persistence Across Tab Switches

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 17.1 | Cache persists on tab switch | Open `file-a.md` (has `^gn` comments). Wait for threads to load. Open Debug Console. Switch to `file-b.md` (same PR, has `^gn` comments). Switch back to `file-a.md`. | On second visit to `file-a.md`, threads appear **instantly** (no API latency). Debug Console shows `[Gitnotate] Thread sync (cache-first): rendering from cache` instead of `[Gitnotate] Thread sync: fetching comments for ...`. | ⬜ |
| 17.2 | Cache-first then background refresh | Open `file-a.md`, wait for threads. Switch away and back. Check Debug Console. | Shows `Thread sync (cache-first): rendering from cache` followed by `Thread sync (cache-first): fetching fresh data`. If data hasn't changed: `Thread sync (cache-first): data unchanged — skipping re-render`. | ⬜ |
| 17.3 | New comment appears after background refresh | While on `file-a.md` in VSCode, add a new `^gn` comment on the same file via the **GitHub web UI** (browser). Switch away from `file-a.md` and back. | Cached (stale) threads render instantly. After the background refresh completes (~1–2s), the new comment appears as an additional thread. Debug Console: `Thread sync (cache-first): data changed — re-rendering`. | ⬜ |
| 17.4 | Single API call per PR, not per file | Open `file-a.md` (PR has comments on both files). Check Debug Console for the API URL. | Only one `GET .../pulls/N/comments?per_page=100&page=1` call. Comments for `file-a.md` are filtered client-side from the full PR comment list. | ⬜ |
| 17.5 | Service recreation on token change | Open a markdown file, let threads load. Run `getGitHubToken` returning a different token (simulate by signing out and back in). Switch tabs. | Debug Console shows `[Gitnotate] Comment sync: recreated PrService + CommentThreadSync (token changed)`. Fresh API call is made (cache was on the old service instance). | ⬜ |

---

## Test Suite 18: Save-Triggered Refresh

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 18.1 | Save markdown triggers re-sync | Open a markdown file with `^gn` comments. Edit the file (add a blank line). Save (`Ctrl+S`). | Debug Console shows `[Gitnotate] Document saved: <filename>` followed by a comment sync. Threads remain correct after the save. | ⬜ |
| 18.2 | Save non-markdown does NOT trigger sync | Open `sample.js`. Edit it. Save (`Ctrl+S`). Check Debug Console. | NO `[Gitnotate] Document saved:` log entry. No comment sync triggered. | ⬜ |
| 18.3 | Save refreshes after line shift | Open a markdown file with a `^gn:10:R:5:15` comment. Add 2 blank lines above line 10 (so the commented line moves to line 12). Save. On GitHub, the comment is still on the original line. | After save, the thread may appear on the wrong line (line 10 per metadata) — this is expected because `^gn` metadata is static. The re-sync confirms no crash occurs. | ⬜ |

---

## Test Suite 19: Close-Tab Thread Cleanup

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 19.1 | Close markdown clears threads | Open `file-a.md` (has `^gn` comments, threads visible). Close the `file-a.md` tab. Open the Comments panel (View → Comments). | Threads from `file-a.md` are no longer listed. Debug Console shows `[Gitnotate] Document closed: <filename>`. | ⬜ |
| 19.2 | Close non-markdown does NOT clear threads | Open `sample.js`. Close its tab. Check Debug Console. | NO `[Gitnotate] Document closed:` log entry. Any open markdown threads are unaffected. | ⬜ |
| 19.3 | Close does NOT invalidate PR cache | Open `file-a.md`, let threads load. Close `file-a.md`. Re-open `file-a.md`. | Threads appear instantly from cache (no API call). Debug Console: `Thread sync (cache-first): rendering from cache`. The PR-level cache is preserved even though the file's threads were cleared on close. | ⬜ |

---

## Test Suite 20: Auth Session Change

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 20.1 | Sign out clears threads | Have a markdown file with `^gn` threads visible. Sign out of GitHub (Command Palette → "GitHub: Sign Out" or revoke the session). | Debug Console shows `[Gitnotate] Auth session changed — invalidating cache and re-syncing`. Threads may disappear (no token → sync skips). | ⬜ |
| 20.2 | Sign in triggers fresh sync | After signing out (test 20.1), sign back in via the Gitnotate sign-in prompt or "GitHub Pull Requests: Sign In". | Debug Console shows `Auth session changed — invalidating cache and re-syncing` then `Comment sync: recreated PrService + CommentThreadSync (token changed)`. Threads reappear with fresh data. | ⬜ |
| 20.3 | Auth change with no active editor | Close all editor tabs. Sign out and back into GitHub. | Debug Console shows the auth change log, but no sync is triggered (no active editor). No crash. | ⬜ |

---

## Test Suite 21: MAX_PAGES Pagination Safety

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 21.1 | Normal pagination works | Open a PR with 150+ review comments. Open a markdown file. Check Debug Console. | Shows `GET .../comments?per_page=100&page=1` then `GET .../comments?per_page=100&page=2`. All comments load. No MAX_PAGES warning. | ⏭️ Covered by unit test |
| 21.2 | MAX_PAGES bound enforced | (Requires a PR with 1000+ review comments — impractical to set up manually.) | After 10 pages, pagination stops. `console.warn` shows `[Gitnotate] MAX_PAGES (10) reached — returning N comments, some may be missing`. | ⏭️ Covered by unit test |

---

## Test Suite 22: Deactivation & Cleanup

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 22.1 | Clean deactivation with hoisted services | Load extension, let threads appear. Close the Extension Development Host window. | Debug Console: `[Gitnotate] Extension deactivating...`. No errors. All hoisted references (`prService`, `threadSync`, `cachedToken`, `commentCtrl`) are cleaned up. | ⬜ |
| 22.2 | Reactivation after deactivation | Close and reopen the Extension Development Host (or reload window with `Developer: Reload Window`). Open a markdown file on a PR branch. | Extension reactivates. Threads load normally. No stale state from previous activation. | ⬜ |

---

## Known Limitations (Phase 1.5 Increment 3)

These are **not bugs** — documented for future increments:

- **Cache-first is not truly async**: `syncForDocumentCacheFirst` renders cached threads immediately but still `await`s the API response inline. The UI is not blocked (VS Code extension host is single-threaded and cooperative), but the function doesn't return until the API call completes. True fire-and-forget background refresh is a future optimization.
- **Cache fingerprint uses comment IDs only**: The cache-first comparison (`JSON.stringify(ids.sort())`) only detects added/removed comments, not edits to existing comment bodies. If someone edits a comment on GitHub without adding/removing one, the cached body stays until a full cache invalidation (tab switch away and back, or save).
- **`sort()` mutates cached array order**: `cached.map(c => c.id).sort()` creates a new array of IDs but `sort()` mutates that intermediate array (not the cache itself). Harmless but should use `[...ids].sort()` for clarity. (Sentinel follow-up F-2)
- **Side hardcoded to RIGHT**: Unchanged from Increment 2. Diff-side detection planned for Increment 5.
- **No reply/resolve from VSCode**: Unchanged from Increment 2. Planned for Increment 5.
- **Gutter `+` creates empty threads**: Unchanged from Increment 2. Planned for Increment 5.
- **Gitnotate sidebar says "no data provider"**: Unchanged. TreeView planned for Increment 4.
- **Duplicate threads with GH PR extension**: Unchanged from Increment 2. Deduplication planned for Increment 5.

---

## Automated Test Coverage

Increment 3 has **153 automated tests** across 12 test files:

| Module | Tests | Stmts | Branches | Funcs | Lines |
|--------|-------|-------|----------|-------|-------|
| `comment-thread-sync.ts` | 17 (+7) | 98.38% | 87.09% | 100% | 98.38% |
| `extension.ts` | 26 (+8) | 92.22% | 91.30% | 100% | 92.22% |
| `pr-service.ts` | 17 (+3) | 89.74% | 67.74% | 100% | 89.74% |
| `comment-controller.ts` | 18 | 100% | 100% | 100% | 100% |
| `utils.ts` (debounce) | 6 | 100% | 100% | 100% | 100% |
| _Other modules_ | 69 | _Unchanged from Increment 2_ | | | |
| **Total** | **153** | **87.15%** | **89.77%** | **100%** | **87.15%** |

All coverage metrics improved from Increment 2. Functions reached 100%.

The manual tests above focus on integration behavior that cannot be verified by unit tests alone — real cache persistence across editor interactions, Debug Console log sequences, Comments panel UI cleanup, and auth session lifecycle in a live VSCode environment.
