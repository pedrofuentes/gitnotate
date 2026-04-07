# Gitnotate VSCode Extension — Test Plan

> **Scope**: Phase 1.5, Increment 5 (UX Polish & Integration)
> **Created**: 2026-04-03
> **Depends on**: Increment 4 test plan (`TEST_PLAN_VSCODE_1.5_4.md`) — suites 23–36 still apply
> **Branch**: `test/increment5-testing` (all 14 feature branches merged)

---

## Trust Level Legend

| Marker | Meaning | Manual check needed? |
|--------|---------|----------------------|
| ✅ Passed | Verified by unit test with meaningful assertions — **high trust** | No |
| 🔍✅ Integration passed | Smoke test in real VSCode — proves no crash, not correct behavior | One spot-check per category recommended |
| ⬜ Manual | Cannot be automated — requires real GitHub auth/API or visual UI | Yes, must verify |
| ⏭️ Covered | Impractical to set up manually — fully covered by unit test | No |

---

## What's New in Increment 5

- **Live comment updates** — ETag-based polling every 30s (configurable) auto-refreshes comments posted on github.com. Pauses on window blur, resumes on focus with immediate fetch.
- **Side-aware comment rendering** — diff views show LEFT-side comments on the old pane and RIGHT-side comments on the new pane. Single file views show all.
- **Side-aware comment posting** — detects cursor side in diff views via URI scheme (`git:` = LEFT, `file:` = RIGHT) instead of hardcoding RIGHT.
- **Sidebar side indicators** — `[Old]`/`[New]` labels on comments in the sidebar tree.
- **Reply/resolve handlers** — reply to comment threads via GitHub API (`in_reply_to_id`), resolve/unresolve toggle (UI-only, GraphQL TODO).
- **Create-a-review API** — uses `/pulls/{n}/reviews` endpoint first (avoids pending review conflict), falls back to single-comment endpoint.
- **Status bar** — `$(git-pull-request) Gitnotate: PR #N` with click-to-refresh.
- **Bidirectional sidebar navigation** — expanding a thread in the editor reveals it in the sidebar.
- **Right-click context menu** — "Add Comment" on text selection in markdown files with active PR.
- **Error UX with action buttons** — "Sign in to GitHub", "Retry", "Open Settings" on errors, with 30s deduplication.
- **Output channel** — `Gitnotate` output channel with `[HH:MM:SS] [LEVEL] [Component]` structured logging.
- **Diff-aware anchor resolution** — `^gn` threads shift with the text when lines are inserted/deleted above them.
- **Change detection fix** — fingerprint now includes `id + body + updatedAt` (was ID-only), so edited comments and updated timestamps trigger re-render.

---

## Prerequisites

Same as Increment 4 (see `TEST_PLAN_VSCODE_1.5_4.md`), plus:

- **Branch**: `test/increment5-testing` worktree at `.worktrees/test-increment5`
- **Build**:
  ```bash
  cd S:\Pedro\Projects\gitnotate\.worktrees\test-increment5\packages\vscode-extension
  pnpm build
  # Press F5 in VSCode to launch Extension Development Host
  ```
- **Test repo**: `pedrofuentes/test`, open PR with:
  - Markdown file with existing `^gn` comments on **both LEFT and RIGHT sides** of the diff
  - If no such PR exists, create one: modify a `.md` file, open PR, add comments on both sides via github.com
- **341 automated tests passing** (run `npx vitest run` to confirm) — ✅ verified
- **22 integration tests passing** (run `pnpm test:integration` to confirm) — ✅ verified

---

## Test Suite 37: Live Comment Updates — ETag & Polling

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 37.1 | ETag stored on first fetch | Open a PR markdown file. Check that `listReviewComments` stores the ETag from the response header. | ETag is cached per PR endpoint key. Subsequent calls include `If-None-Match` header. | ✅ Passed |
| 37.2 | 304 Not Modified returns null | Second fetch to same PR with unchanged data. | `listReviewComments` returns `null`, no re-render triggered. | ✅ Passed |
| 37.3 | Fingerprint detects body edits | Cached comments have same IDs but different `body` text. | `syncForDocumentCacheFirst` detects change and re-renders. | ✅ Passed |
| 37.4 | Fingerprint detects updatedAt change | Cached comments have same IDs and bodies but different `updatedAt`. | Re-render triggered. | ✅ Passed |
| 37.5 | Polling timer starts on PR file | Open a PR markdown file. | `startPolling` is called, `isPolling` is true. | ✅ Passed |
| 37.6 | Polling timer stops on non-PR file | Switch to a non-markdown file. | `stopPolling` is called, `isPolling` is false. | ✅ Passed |
| 37.7 | Polling interval from config | Set `gitnotate.pollInterval` to 15. | Polling interval is 15000ms. | ✅ Passed |
| 37.8 | Polling minimum 10s enforced | Set `gitnotate.pollInterval` to 5. | Interval clamped to 10000ms. | ✅ Passed |
| 37.9 | Polling errors are silent | API returns error during poll tick. | No user-facing error message. Polling continues. | ✅ Passed |
| 37.10 | New comment appears via polling | Open a PR markdown file in VSCode. On github.com, add a new `^gn` comment on the same file. Wait ~30 seconds. | New comment thread appears in VSCode without manual refresh. Output channel: sync log with fresh data. | ✅ Manual verified |
| 37.11 | Edited comment updates via polling | Note an existing comment's text. On github.com, edit that comment's body. Wait ~30 seconds. | Comment text in VSCode updates to the new body. | ✅ Manual verified |
| 37.12 | New reply appears via polling | On github.com, reply to an existing thread. Wait ~30 seconds. | Reply appears in the thread in VSCode. | ✅ Manual verified |
| 37.13 | Polling pauses on window blur | Open a PR file (polling active). Alt-Tab to another application. On github.com, add a comment. Return to VSCode. | Comment appears shortly after returning — immediate fetch on focus regain. While away, no polling occurred. Debug Console: `Window lost focus — stopping polling` / `Window gained focus — re-syncing and resuming polling`. | ✅ Manual verified |
| 37.14 | Poll interval setting | Open Settings → search `gitnotate.pollInterval`. | Setting exists with default 30, minimum 10. Change to 15 → polling happens every ~15s. | ✅ Manual verified |

---

## Test Suite 38: Side-Aware Comment Rendering

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 38.1 | `git:` URI → LEFT detection | `detectDocumentSide(uri)` with `scheme: 'git'`. | Returns `'LEFT'`. | ✅ Passed |
| 38.2 | `file:` URI → RIGHT detection | `detectDocumentSide(uri)` with `scheme: 'file'`. | Returns `'RIGHT'`. | ✅ Passed |
| 38.3 | Unknown scheme → BOTH | `detectDocumentSide(uri)` with `scheme: 'untitled'`. | Returns `'BOTH'`. | ✅ Passed |
| 38.4 | L → LEFT normalization | `normalizeSide('L')`. | Returns `'LEFT'`. | ✅ Passed |
| 38.5 | R → RIGHT normalization | `normalizeSide('R')`. | Returns `'RIGHT'`. | ✅ Passed |
| 38.6 | RIGHT-only on file: URI | Render comments with mixed L/R sides on a `file:` URI document. | Only R/RIGHT comments rendered. | ✅ Passed |
| 38.7 | LEFT-only on git: URI | Render comments with mixed L/R sides on a `git:` URI document. | Only L/LEFT comments rendered. | ✅ Passed |
| 38.8 | All comments in BOTH mode | Render comments on an unknown-scheme URI. | All comments rendered regardless of side. | ✅ Passed |
| 38.9 | Diff view: LEFT comments on old pane | Open a markdown diff view (Git panel → click changed `.md` file). Click on the **left pane** (old/red content). | Only LEFT-side comments appear. RIGHT-side comments are NOT visible. | ✅ Manual verified |
| 38.10 | Diff view: RIGHT comments on new pane | In the same diff view, click on the **right pane** (new/green content). | Only RIGHT-side comments appear. LEFT-side comments are NOT visible. | ✅ Manual verified |
| 38.11 | Single file view shows RIGHT only | Open the markdown file normally (not as diff — click in Explorer). | Only RIGHT/New comments appear (current version). LEFT/Old comments hidden since they may reference deleted text. | ✅ Manual verified |
| 38.12 | Inline diff view behavior | Set `diffEditor.renderSideBySide` to `false`. Open a markdown diff. | Observe comment behavior. Document any issues — this may need follow-up handling. | ⚠️ Known limitation: inline diff mode — TabInputTextDiff detected but URI-based thread placement may not work correctly in inline mode. Defer to follow-up. |

---

## Test Suite 39: Side-Aware Comment Posting

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 39.1 | file: URI → R/RIGHT | Post comment from `file:` scheme document. | Metadata contains `:R:`, API call uses `'RIGHT'`. | ✅ Passed |
| 39.2 | git: URI → L/LEFT | Post comment from `git:` scheme document. | Metadata contains `:L:`, API call uses `'LEFT'`. | ✅ Passed |
| 39.3 | Unknown URI defaults to R/RIGHT | Post comment from `untitled:` scheme document. | Defaults to `:R:` / `'RIGHT'`. | ✅ Passed |
| 39.4 | Post from RIGHT diff pane | Open diff view, select text in the **right pane** (new/green). Run "Gitnotate: Add Comment". Enter a comment. | On github.com PR → Files Changed, the comment appears on the **RIGHT** side. `^gn` metadata contains `:R:`. | ✅ Manual verified |
| 39.5 | Post from LEFT diff pane | Open diff view, select text in the **left pane** (old/red). Run "Gitnotate: Add Comment". Enter a comment. | On github.com, the comment appears on the **LEFT** side. `^gn` metadata contains `:L:`. | ✅ Manual verified |

---

## Test Suite 40: Sidebar Side Indicators

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 40.1 | LEFT comment shows [Old] | Comment with `side: 'LEFT'` or `^gn` with `:L:`. | Sidebar description ends with `[Old]`. | ✅ Passed |
| 40.2 | RIGHT comment shows [New] | Comment with `side: 'RIGHT'` or `^gn` with `:R:`. | Sidebar description ends with `[New]`. | ✅ Passed |
| 40.3 | Missing side → no indicator | Comment without side field. | No `[Old]`/`[New]` suffix. | ✅ Passed |
| 40.4 | Side indicators visible in sidebar | Open the Gitnotate sidebar (activity bar icon). | Comments on old/LEFT side show `[Old]`, comments on new/RIGHT side show `[New]`. | 🔍✅ Integration passed |

---

## Test Suite 41: Reply & Resolve Handlers

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 41.1 | createReplyComment payload | Call `createReplyComment(pr, body, inReplyToId)`. | POST to `/pulls/{n}/comments` with `{ body, in_reply_to_id }`. | ✅ Passed |
| 41.2 | Reply handler calls API | Type reply in thread reply box, submit. | `createReplyComment` called with correct `parentCommentId` from thread. | ✅ Passed |
| 41.3 | Resolve sets thread state | Call `resolveThread` on a comment thread. | `thread.state = CommentThreadState.Resolved`. | ✅ Passed |
| 41.4 | Unresolve sets thread state | Call `unresolveThread` on a resolved thread. | `thread.state = CommentThreadState.Unresolved`. | ✅ Passed |
| 41.5 | parentCommentId tracked | Create thread with `parentCommentId`. Query via `getParentCommentId(thread)`. | Returns the original root comment ID. | ✅ Passed |
| 41.6 | Reply from VSCode → appears in GitHub | Expand a comment thread in VSCode. Type a reply, submit. | Reply appears in the thread in VSCode. On github.com (refresh PR page), the reply is visible. | ✅ Manual verified |
| 41.7 | Resolve/unresolve toggle | Right-click a comment thread → "Resolve Thread". | Thread appears resolved (collapsed/dimmed). Right-click again → "Unresolve Thread" → returns to normal. Note: UI-only for now (not synced to GitHub API — GraphQL TODO). | ⚠️ Known limitation: resolve button not visible in thread UI. Defer to follow-up. |
| 41.8 | Reply context menu on threads | Right-click on a Gitnotate comment thread. | Reply/resolve/unresolve options visible in context menu. | 🔍✅ Integration passed |

---

## Test Suite 42: Create-a-Review API

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 42.1 | Review endpoint payload | Call `createReviewWithComment(pr, path, line, side, body)`. | POST to `/pulls/{n}/reviews` with `{ event: 'COMMENT', comments: [{ path, line, side, body }], commit_id }`. | ✅ Passed |
| 42.2 | Review-first strategy | Post a comment via `addCommentCommand`. | Tries `createReviewWithComment` first. On success, does NOT call `createReviewComment`. | ✅ Passed |
| 42.3 | Fallback to single-comment | `createReviewWithComment` fails. | Falls back to `createReviewComment`. Comment still posts. | ✅ Passed |
| 42.4 | Works with GH PR pending review | Install GitHub Pull Requests extension. Start a review (don't submit — leave pending). Try to add a Gitnotate comment. | Comment posts successfully via review endpoint. No 422 error. | ⬜ Manual |

---

## Test Suite 43: Status Bar

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 43.1 | show() displays PR number | Call `statusBar.show(42)`. | Text: `$(git-pull-request) Gitnotate: PR #42`. | ✅ Passed |
| 43.2 | hide() hides item | Call `statusBar.hide()`. | Status bar item is hidden. | ✅ Passed |
| 43.3 | setLoading() shows spinner | Call `statusBar.setLoading()`. | Text: `$(sync~spin) Gitnotate: Loading...`. | ✅ Passed |
| 43.4 | setError() shows error | Call `statusBar.setError('msg')`. | Text: `$(error) Gitnotate: Error`. Tooltip: `msg`. | ✅ Passed |
| 43.5 | Click triggers refresh | Click status bar item. | `gitnotate.refreshComments` command executes. | ✅ Passed |
| 43.6 | Status bar shows PR number | Open a markdown file from a PR branch. | Bottom-right status bar shows `Gitnotate: PR #N`. Click → comments refresh. | 🔍✅ Integration passed |
| 43.7 | Status bar hidden without PR | Open a markdown file on a branch with no PR (e.g., main). | No Gitnotate status bar item visible. | 🔍✅ Integration passed |

---

## Test Suite 44: Bidirectional Sidebar Navigation

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 44.1 | revealByCommentId finds item | Call `revealByCommentId(existingId)`. | `treeView.reveal(item, { select: true, focus: false, expand: true })` called. | ✅ Passed |
| 44.2 | Unknown ID no-ops | Call `revealByCommentId(999)`. | No error, no reveal call. | ✅ Passed |
| 44.3 | Thread creation triggers reveal | Create thread via `createThread` with `commentId`. | `onThreadRevealed` callback fires with the comment ID. | ✅ Passed |
| 44.4 | Editor thread → sidebar highlight | Open a file with comment threads. Click/expand a thread in the editor. | The corresponding comment in the Gitnotate sidebar is highlighted/selected/revealed. | ⬜ Manual |

---

## Test Suite 45: Right-Click Context Menu

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 45.1 | package.json menu entry | Read `contributes.menus['editor/context']`. | Entry for `gitnotate.addComment` with `when: "editorHasSelection && resourceLangId == markdown && gitnotate.hasPR"`. | ✅ Passed |
| 45.2 | Right-click shows "Add Comment" | Open a markdown file on a PR branch. Select text. Right-click. | "Gitnotate: Add Comment" appears in the context menu. Click → comment input opens. | ⬜ Manual |
| 45.3 | Hidden without text selection | Right-click in a markdown file without selecting text. | "Gitnotate: Add Comment" does NOT appear. | ⬜ Manual |
| 45.4 | Hidden on non-markdown file | Open a `.ts` or `.json` file on a PR branch. Select text. Right-click. | "Gitnotate: Add Comment" does NOT appear. | 🔍✅ Integration passed |

---

## Test Suite 46: Error UX with Action Buttons

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 46.1 | Auth error shows "Sign in" | `showAuthError()` called. | Error message: "Gitnotate: GitHub authentication required" with "Sign in to GitHub" button. | ✅ Passed |
| 46.2 | "Sign in" triggers auth flow | Click "Sign in to GitHub" button. | `authentication.getSession('github', ['repo'], { createIfNone: true })` is called. | ✅ Passed |
| 46.3 | API error shows "Retry" | `showApiError('Failed to fetch')` called. | Error message with "Retry" button. | ✅ Passed |
| 46.4 | "Retry" refreshes comments | Click "Retry" button. | `gitnotate.refreshComments` command executes. | ✅ Passed |
| 46.5 | Deduplication within 30s | Call `showAuthError()` twice within 30 seconds. | Only one error message shown. | ✅ Passed |
| 46.6 | "Sign in" action end-to-end | Sign out of GitHub. Open a PR markdown file. | Error appears with "Sign in to GitHub". Click → GitHub sign-in flow starts. | ⬜ Manual |
| 46.7 | "Retry" action end-to-end | Temporarily lose network, try to refresh. | Error appears with "Retry". Restore network, click → comments load. | 🔍✅ Integration passed |

---

## Test Suite 47: Output Channel

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 47.1 | Info format correct | `logger.info('PrService', 'fetching')`. | Output: `[HH:MM:SS] [INFO] [PrService] fetching`. | ✅ Passed |
| 47.2 | Warn format correct | `logger.warn('Sync', 'stale cache')`. | Output: `[HH:MM:SS] [WARN] [Sync] stale cache`. | ✅ Passed |
| 47.3 | Error format correct | `logger.error('API', 'request failed')`. | Output: `[HH:MM:SS] [ERROR] [API] request failed`. | ✅ Passed |
| 47.4 | Channel name is 'Gitnotate' | `createLogger()` called. | `vscode.window.createOutputChannel('Gitnotate')`. | ✅ Passed |
| 47.5 | Output panel shows logs | Open Output panel (View → Output). Select "Gitnotate" from dropdown. Interact with extension. | Log lines appear with structured format. API calls, sync events, cache hits/misses visible. | 🔍✅ Integration passed |

---

## Test Suite 48: Diff-Aware Anchor Resolution

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 48.1 | Insert above → shift down | Insert 1 line above a tracked thread at line 10. | Thread range shifts to line 11. | ✅ Passed |
| 48.2 | Delete above → shift up | Delete 1 line above a tracked thread at line 10. | Thread range shifts to line 9. | ✅ Passed |
| 48.3 | Multi-line insert → correct delta | Insert 3 lines above a thread. | Thread shifts down by 3. | ✅ Passed |
| 48.4 | Same-line edit → no shift | Edit text within the thread's line (no newlines). | Thread stays at same line. | ✅ Passed |
| 48.5 | Changes below → no shift | Insert lines below a thread. | Thread stays at same line. | ✅ Passed |
| 48.6 | Multiple threads shift correctly | Two threads at lines 5 and 10. Insert 2 lines at line 3. | Thread at 5 → 7, thread at 10 → 12. | ✅ Passed |
| 48.7 | reset() clears all anchors | Call `reset(uri)`. | `getAnchorCount(uri)` returns 0. | ✅ Passed |
| 48.8 | dispose() cleans up | Call `dispose()`. | Event subscription removed, anchors cleared. | ✅ Passed |
| 48.9 | Comment follows text after insertion | Open a markdown file with a `^gn` comment on line 10. Go to line 5, insert 3 blank lines (press Enter 3×). | Comment thread moves to line 13 (shifted down by 3). Highlight stays on correct text. | ⬜ Manual |
| 48.10 | Comment follows text after deletion | Delete 2 lines above the comment. | Comment thread shifts up by 2. | ⬜ Manual |

---

## Summary

| Suite | Total | ✅ Passed | 🔍✅ Passed | ⬜ Manual | ⏭️ Covered |
|-------|-------|-----------|------------|----------|------------|
| 37. Live Updates | 14 | 9 | 0 | 5 | 0 |
| 38. Side Rendering | 12 | 8 | 0 | 4 | 0 |
| 39. Side Posting | 5 | 3 | 0 | 2 | 0 |
| 40. Sidebar Side | 4 | 3 | 1 | 0 | 0 |
| 41. Reply/Resolve | 8 | 5 | 1 | 2 | 0 |
| 42. Create Review API | 4 | 3 | 0 | 1 | 0 |
| 43. Status Bar | 7 | 5 | 2 | 0 | 0 |
| 44. Sidebar Bidir | 4 | 3 | 0 | 1 | 0 |
| 45. Context Menu | 4 | 1 | 1 | 2 | 0 |
| 46. Error UX | 7 | 5 | 1 | 1 | 0 |
| 47. Output Channel | 5 | 4 | 1 | 0 | 0 |
| 48. Anchor Resolution | 10 | 8 | 0 | 2 | 0 |
| **TOTAL** | **84** | **57 ✅** | **7 ✅** | **20** | **0** |

---

## Your Manual Checklist

### ⬜ Must verify (no automation possible)

**Priority 1 — Core new features (test these first):**

| # | Test | What to check |
|---|------|---------------|
| 37.10 | Live update: new comment | Open PR `.md` file. Add `^gn` comment via github.com. Wait 30s. Verify thread appears in VSCode. |
| 38.9 | LEFT comments on old pane | Open diff view. Click left (old/red) pane. Only LEFT-side comments visible. |
| 38.10 | RIGHT comments on new pane | Click right (new/green) pane. Only RIGHT-side comments visible. |
| 39.4 | Post from RIGHT pane | Select text in right diff pane. "Add Comment". On github.com → comment on RIGHT side. `^gn` has `:R:`. |
| 39.5 | Post from LEFT pane | Select text in left diff pane. "Add Comment". On github.com → comment on LEFT side. `^gn` has `:L:`. |
| 41.6 | Reply → appears in GitHub | Reply in VSCode thread. Refresh github.com PR page. Reply visible. |
| 48.9 | Anchor: insert lines above | Comment on line 10. Insert 3 lines at line 5. Thread moves to line 13. |

**Priority 2 — Important UX:**

| # | Test | What to check |
|---|------|---------------|
| 37.13 | Polling pauses on blur | Alt-Tab away, add comment on github.com, return. Comment appears on focus. |
| 38.11 | Single file shows all | Open `.md` normally (not diff). Both L and R comments visible. |
| 41.7 | Resolve/unresolve toggle | Right-click thread → Resolve. Thread collapses. Unresolve → back to normal. |
| 44.4 | Editor → sidebar reveal | Expand thread in editor → sidebar highlights corresponding item. |
| 45.2 | Context menu "Add Comment" | Select text in PR markdown, right-click → "Gitnotate: Add Comment" visible. |
| 46.6 | "Sign in" error action | Sign out, open PR file. Error with "Sign in to GitHub" button. Click → auth starts. |

**Priority 3 — Edge cases (test if time permits):**

| # | Test | What to check |
|---|------|---------------|
| 37.11 | Edited comment updates | Edit comment on github.com, wait 30s → VSCode updates. |
| 37.12 | New reply via polling | Reply on github.com, wait 30s → reply appears in VSCode. |
| 37.14 | Poll interval setting | Change `gitnotate.pollInterval` to 15 → polling cadence changes. |
| 38.12 | Inline diff behavior | Set `diffEditor.renderSideBySide: false`. Document behavior. |
| 42.4 | Pending review coexistence | Start GH PR extension review, then post Gitnotate comment. No 422 error. |
| 45.3 | Menu hidden without selection | Right-click without selection → "Add Comment" not visible. |
| 48.10 | Anchor: delete lines above | Delete 2 lines above comment → thread shifts up by 2. |

### 🔍 Recommended spot-checks (one per category, first time only)

| Category | Test | What to verify |
|----------|------|----------------|
| Sidebar side | 40.4 | Open sidebar → `[Old]`/`[New]` labels visible on comments |
| Reply menu | 41.8 | Right-click thread → reply/resolve options in context menu |
| Status bar | 43.6 | Open PR file → `Gitnotate: PR #N` in bottom-right status bar |
| Status bar hidden | 43.7 | Open non-PR file → no Gitnotate status bar item |
| Context menu negative | 45.4 | Open `.ts` file, select text, right-click → no "Add Comment" |
| Error retry | 46.7 | Lose network → error with "Retry" button → restore → click works |
| Output channel | 47.5 | View → Output → "Gitnotate" → structured log lines appear |
