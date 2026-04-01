# Gitnotate — Manual Test Plan

> Updated: 2026-03-28
> Test repo: https://github.com/pedrofuentes/test/pull/5

---

## Prerequisites

### Build & Load

```bash
cd S:\Pedro\Projects\gitnotate
pnpm install
pnpm -r build
```

Load in Edge/Chrome:
1. `edge://extensions` → Developer mode ON
2. **Load unpacked** → select `packages/browser-extension/dist`
3. Pin to toolbar

### Test Repo

- PR: https://github.com/pedrofuentes/test/pull/5
- File: `docs/q3-strategy.md` (41 lines of rich markdown)

---

## Test Suite 1: Extension Loading

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1.1 | Content script loads | Navigate to any github.com page, open DevTools Console (F12) | `[Gitnotate] Content script loaded at: ...` | ✅ |
| 1.2 | Service worker loads | Check `edge://extensions` → Gitnotate → inspect service worker | `Gitnotate service worker started` | ✅ |
| 1.3 | Popup opens | Click Gitnotate icon in toolbar | Shows "Gitnotate" title, subtitle, status, repos section | ✅ |
| 1.4 | Popup — no repos | First use, open popup | Shows "No repos enabled yet. Visit a PR and click Enable when prompted." | ✅ |
| 1.5 | Popup — API Access collapsed | Check popup "API Access" section | Collapsed `<details>` — click to expand for PAT entry | ✅ |

---

## Test Suite 2: Page Detection

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 2.1 | PR Files Changed | Navigate to PR → "Files changed" tab (URL: `/pull/5/changes`) | Console: `type: 'pr-files-changed'` | ✅ |
| 2.2 | PR Conversation | Navigate to PR → conversation tab (URL: `/pull/5`) | Console: `type: 'pr-conversation'` | ✅ |
| 2.3 | File view | Navigate to a `.md` file in a repo (blob view) | Console: `type: 'file-view'` | ✅ |
| 2.4 | Other page | Navigate to github.com dashboard | Console: `type: 'other'` | ✅ |
| 2.5 | SPA navigation | Go from PR conversation → click "Files changed" tab | Console: `URL changed (mutation observer)` then `pr-files-changed` detected | ✅ |

---

## Test Suite 3: Per-Repo Opt-In

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 3.1 | Banner on first visit | Navigate to a PR for a new repo | Banner: "Enable Gitnotate for owner/repo?" with Enable + Not now | ✅ |
| 3.2 | Enable | Click "Enable" | Banner disappears, features activate | ✅ |
| 3.3 | Dismiss | On another repo, click "Not now" | Banner disappears, no features | ✅ |
| 3.4 | Remember choice | Return to enabled repo | No banner, features work immediately | ✅ |
| 3.5 | Popup shows repos | Open popup after enabling | Shows repo under "Enabled Repositories" | ✅ |

---

## Test Suite 4: Text Selection & Metadata Injection

> **Flow**: Click "+" on a line → GitHub opens comment form → select text in diff → metadata auto-injected

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | Select text with form open | Click "+" on a diff line, then select text in that line | Console: `Selection + open textarea detected, injecting @gn metadata` | ✅ |
| 4.2 | Metadata format | Check the textarea content after injection | Contains `` `@gn:start:end` `` at the end, cursor positioned for typing | ✅ |
| 4.3 | Text highlighted | After injection, check the diff line | Selected text has yellow highlight (`gn-highlight` class) | ✅ |
| 4.4 | No form open — no injection | Select text WITHOUT a comment form open | No injection, no highlight (selection is just normal) | ✅ |
| 4.5 | Select text in different line | With form open on line 5, select text in line 9 | Metadata injected with correct offsets for line 9 | ✅ |
| 4.6 | Multi-line selection | Select text spanning two diff lines | `getSelectionInfo()` returns null — no injection | ✅ |

---

## Test Suite 5: Comment Submission & Persistence

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5.1 | Submit comment | Type comment text after injected metadata, click "Comment" or "Start review" | Comment posted to GitHub | ✅ |
| 5.2 | Metadata survives | View the posted comment (on page or in another browser) | Comment shows: `your text @gn:start:end` (code tag visible) | ✅ |
| 5.3 | Re-highlight on reload | Reload the PR Files Changed page | Console: `Found @gn:start:end` — text re-highlighted | ✅ |
| 5.4 | Without extension | View comment in browser without Gitnotate | Comment text + `@gn:5:209` code tag visible — readable but not highlighted | ✅ |

---

## Test Suite 6: Cancel & Highlight Cleanup

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6.1 | Cancel pending highlight | Inject metadata + highlight, click "Cancel" on comment form | Highlight removed (pending highlight cleaned up) | ✅ |
| 6.2 | Cancel auto-saved draft | Inject metadata, reload (GitHub auto-saves draft), click "Cancel" | Draft discarded, highlight removed (re-scan finds 0 comments) | ✅ |
| 6.3 | Submit then delete | Submit comment, then open+cancel another comment on same line | Submitted comment's highlight stays, new pending removed | ✅ |

---

## Test Suite 7: Multiple Comments

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7.1 | Multiple comments on different lines | Add @gn comments on lines 5, 9, and 17 | All three texts highlighted independently | ✅ |
| 7.2 | Multiple comments on same line | Add two @gn comments targeting different text on the same line | Both highlights visible (non-overlapping) | ✅ |
| 7.3 | Console count | Check console after page with multiple comments | `Found N @gn comment(s)` with correct count | ✅ |

---

## Test Suite 8: Edge Cases

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8.1 | Special characters | Select text with `"quotes"`, `<html>`, or `&amp;` | Metadata injected correctly, no broken formatting | ✅ |
| 8.2 | Very long selection | Select an entire paragraph (100+ chars) | Metadata has correct start/end offsets | ✅ |
| 8.3 | Short selection | Select a single character | Works (highlight may be tiny but valid) | ✅ |
| 8.4 | Extension context invalidated | Reload extension, then navigate on GitHub | "Extension context invalidated" error — fixed by hard refresh (Ctrl+Shift+R) | ✅ (known) |
| 8.5 | No scan spam | Hover over various elements on the diff page | Console does NOT show repeated `Found @gn` messages on every hover | ✅ |

---

## Test Suite 9: Popup Auth (API Access)

> Only needed for sidecar mode (file-view commenting). Not required for PR commenting.

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9.1 | Expand API Access | Click "API Access (optional)" in popup | Expands to show PAT input | ⬜ |
| 9.2 | Create PAT link | Click "Create PAT ↗" | Opens GitHub token creation page | ⬜ |
| 9.3 | Save valid PAT | Enter valid PAT, click Save | Shows "Signed in as @username" | ⬜ |
| 9.4 | Save invalid PAT | Enter invalid token, click Save | Shows error message | ⬜ |
| 9.5 | Sign out | Click "Sign out" | Returns to PAT input state | ⬜ |

---

## Test Suite 10: Performance

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 10.1 | Large diff | Open a PR with 500+ lines changed | Extension loads without lag | ⬜ |
| 10.2 | Many comments | PR with 10+ @gn comments | All found and highlighted efficiently | ⬜ |
| 10.3 | Scanner performance | Check console timing for scan | `Found N @gn comment(s)` appears within ~100ms | ⬜ |

---

## Legend

- ✅ Tested and working
- ⬜ Not yet tested
- ❌ Tested and failing

## Quick Test Checklist

- [x] Extension loads and detects pages
- [x] Opt-in banner appears and enables repo
- [x] Text selection + metadata injection works
- [x] Highlight appears on selected text
- [x] Comment survives GitHub submission (`@gn:s:e` format)
- [x] Highlights re-appear on page reload
- [x] Cancel removes pending highlights
- [x] No scan spam on hover
- [x] Multiple comments on different lines
- [x] Graceful degradation without extension
- [ ] Edge cases (special chars, long text)
