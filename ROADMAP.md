# Gitnotate — Roadmap

> **Gitnotate** (git + annotate) — Sub-line commenting for Markdown files in Git/GitHub workflows.
> License: MIT | Repository: https://github.com/pedrofuentes/gitnotate

---

## Problem Statement

As AI agents increasingly use Markdown files for professional work (specs, proposals, docs, plans), teams adopt Git/GitHub for versioning. This brings excellent traceability but loses a key Word/Google Docs capability: **commenting on a specific phrase or word within a line**, not just on a whole line.

**GitHub's current limitation**: PR reviews only support line-level comments. You can comment on line 42, but not on the word "revenue" in line 42. This is a real friction point for document-centric workflows.

---

## Research Summary

### The Gold Standard: Microsoft Word & Google Docs

**Microsoft Word** uses a split-storage architecture (OOXML):
- Content in `word/document.xml` with `<w:commentRangeStart>`/`<w:commentRangeEnd>` anchor markers
- Comment definitions in a separate `word/comments.xml` file
- Supports: text-range anchoring (any phrase), margin balloons, threaded replies, resolve/reopen, @mentions, task assignment, author tracking, rich formatting, filter by reviewer, navigation, Track Changes (suggest edits)

**Google Docs** provides similar capabilities plus:
- Suggesting mode (inline edit proposals with Accept/Reject)
- Emoji reactions on comments
- Real-time collaboration

### Key Design Lessons

1. **Separate storage**: Both Word and Docs keep comments separate from content. Our sidecar `.comments/` approach mirrors Word's `comments.xml`.
2. **Text-range anchoring is essential**: Users expect to highlight a phrase, not just a line.
3. **Two views matter**: Contextual/inline view near the text + list/panel view for all comments.
4. **Resolve ≠ delete**: Resolved comments stay accessible but hidden. Important for audit trails.
5. **Threading is expected**: Flat comments feel incomplete — replies create conversation context.
6. **Suggest edits is a power feature**: Plan for "suggest text replacement" as a future comment type.

### Existing Tools Gap Analysis

| Tool | Sub-line? | Git-stored? | GitHub-aware? | Works without extension? |
|---|---|---|---|---|
| **Hypothesis** (browser) | ✅ | ❌ (own servers) | ❌ | N/A |
| **CriticMarkup** (syntax) | ✅ | ✅ (in-file) | ❌ (raw syntax shown) | ✅ (but ugly) |
| **Web Highlights** | ✅ | ❌ | ❌ | N/A |
| **VSCode Markdown Comment** | ✅ | ⚠️ (metadata file) | ❌ | N/A |
| **GitHub PR comments** | ❌ (line-only) | N/A | ✅ | ✅ |
| **Gitnotate (ours)** | ✅ | ✅ | ✅ | ✅ (graceful degradation) |

**No existing tool combines**: sub-line commenting + git-native storage + GitHub integration + graceful degradation without the extension.

### Notable Competitor

**remarq** (cass-clearly/remarq) — "Structured document annotations with REST API + MCP. Replace Google Docs commenting with agent-consumable feedback." Created Feb 2026, 5 stars. Different approach: self-hosted REST API backend, not GitHub-native.

---

## Architecture: Two-Tier Approach

### Tier 1: DOM-Based PR Comment Mode — `^gn` Metadata ✅ SHIPPED (v0.1.0)

The simplest, fastest approach. Injects sub-line metadata directly into GitHub's own PR comment textareas using pure DOM manipulation — no API calls, no OAuth, no network requests.

**How it works:**

When a user selects specific text within a line in a PR diff, the extension:
1. Detects the selection's line number and character range within the diff
2. Opens GitHub's native comment textarea for that line (via DOM interaction)
3. Injects a `^gn:LINE:SIDE:START:END` metadata marker followed by a human-readable quote into the textarea
4. The user adds their comment and submits using GitHub's own UI (the extension never calls any API)

**Comment format:**

```
^gn:42:R:12:47
> 📌 **"revenue growth exceeded expectations"** (chars 12–47)

Can we add the exact percentage here?
```

Two layers:
1. `^gn:LINE:SIDE:START:END` — Machine-readable metadata line (caret prefix avoids GitHub @mention conflicts) — parsed by the extension
2. `> 📌 **"quoted text"**` — Human-readable fallback — visible even without extension
3. Actual comment text below

**Graceful degradation:**

| Viewer | Experience |
|---|---|
| With Gitnotate extension | Highlighted text range in diff, refined comment indicator |
| Without extension | Normal line comment with `^gn:` prefix and quoted text block — perfectly usable |
| GitHub mobile app | Same as without extension |
| Email notification | Same — blockquote makes reference clear |
| API / AI agent | Parse `^gn:LINE:SIDE:START:END` metadata or read quoted text |

**Advantages:**
- Zero extra files, zero infrastructure, zero commits, zero API calls
- No authentication required — works entirely through DOM manipulation
- All GitHub features work out of the box: threading, resolve, reactions, @mentions, notifications, email
- Uses GitHub's existing PR comment permissions (no repo write needed)
- Searchable via GitHub's comment search

**Limitations:**
- Only works on PR diffs (not standalone file views)
- Character offsets fragile if line is subsequently edited
- Dependent on GitHub's DOM structure (may require updates when GitHub changes their UI)

### Tier 2: Full Mode — Sidecar `.comments/*.json` Files 🔮 PLANNED

For persistent comments outside PRs, stored in the repository. **Not yet implemented — planned for Phase 2.**

**Structure:**
```
my-repo/
├── docs/
│   ├── proposal.md
│   └── .comments/
│       └── proposal.md.json        ← Comments for proposal.md
└── .gitattributes                   ← Optional: merge strategy
```

**Schema (W3C Web Annotation-aligned):**
```json
{
  "$schema": "https://gitnotate.dev/schema/v1.json",
  "version": "1.0",
  "file": "proposal.md",
  "annotations": [
    {
      "id": "a1b2c3",
      "target": {
        "exact": "revenue growth exceeded expectations",
        "prefix": "In Q3, our ",
        "suffix": " by a significant margin"
      },
      "created": "2026-03-27T20:00:00Z",
      "author": { "github": "pedro", "name": "Pedro" },
      "body": "Can we add the exact percentage here?",
      "resolved": false,
      "replies": [
        {
          "id": "d4e5f6",
          "author": { "github": "maria", "name": "Maria" },
          "created": "2026-03-27T21:00:00Z",
          "body": "Done — added 23% growth figure"
        }
      ]
    }
  ]
}
```

**Anchor strategy**: Uses W3C TextQuoteSelector pattern — `exact` match with `prefix`/`suffix` context for resilience against nearby edits.

**Storage & sharing**: Comments are regular files in the repo → pushed/pulled via git. Everyone who clones/pulls gets all comments. Extension reads via GitHub Contents API (browser) or filesystem (VSCode).

---

## Implementation Phases

### Phase 1: DOM-Based PR Comment Mode — Browser Extension ✅ COMPLETE (v0.1.0)

**Deliverable:** Chrome/Edge extension (Manifest V3) — **RELEASED**

- ✅ Scaffold extension: manifest.json, content scripts targeting `github.com`, popup UI
- ✅ Detect PR diff pages (Files Changed view) on github.com
- ✅ Enable text selection within diff lines (override GitHub's default line-only selection)
- ✅ On text selection → show floating "Comment" button
- ✅ Define `^gn:LINE:SIDE:START:END` metadata format for PR comment bodies
- ✅ Inject metadata + human-readable quoted text into GitHub's native comment textarea via DOM manipulation (no API calls)
- ✅ Parse existing PR comments for `^gn` metadata
- ✅ Highlight exact text ranges within diff lines for `^gn`-enhanced comments
- ✅ Graceful degradation for users without the extension

**Tech stack:** TypeScript, Manifest V3 (Chrome/Edge), Vite, pure DOM manipulation (no GitHub API, no OAuth)

### Phase 1.5: PR Comment Mode — VSCode Extension ✅ COMPLETE

**Deliverable:** VSCode extension with `^gn` sub-line commenting via GitHub PR review comments

**Architecture decisions** (from research — see `docs/internal/VSCODE-GHPR-INTEGRATION.md`):
- **`vscode.authentication`** for GitHub OAuth — shared session with GH PR extension, no PAT management
- **VSCode Comments API** (`createCommentController`) for native comment threading — replaces custom decorations
- **VSCode Git API** (`vscode.git`) for branch/remote detection — replaces `child_process` shell calls
- **Companion extension** — works standalone, complements GitHub Pull Requests extension when installed

#### Increment 1: Auth + Git Service Foundation ✅ COMPLETE

- ✅ `auth.ts` — OAuth wrapper via `vscode.authentication.getSession('github', ['repo'])`
- ✅ `git-service.ts` — VSCode Git API wrapper (branch, remote, commit, owner/repo parsing)
- ✅ Refactored `pr-detector.ts` — accepts `GitService` + token via dependency injection
- ✅ Refactored `comment-command.ts` — migrated from PAT to OAuth auth flow
- ✅ Refactored `extension.ts` — wired new modules, removed `checkGitHubToken()` PAT warning
- ✅ Removed `gitnotate.githubToken` config setting (replaced by OAuth)
- ✅ URL parameters percent-encoded in GitHub API calls
- ✅ 95 tests, 97.53% coverage

#### Increment 2: Comment Controller & Thread Sync ✅ COMPLETE

Core pipeline — fetch PR comments, parse `^gn` metadata, display as native comment threads.

- ✅ `comment-controller.ts` — wraps `vscode.comments.createCommentController` with sub-line ranges
- ✅ `comment-thread-sync.ts` — orchestrator: fetch → parse → create threads, with in-memory cache
- ✅ Renamed `github-api.ts` → `pr-service.ts` with extended response fields (`side`, `in_reply_to_id`, `user.login`)
- ✅ Wired `onDidChangeActiveTextEditor` handler with 300ms debounce
- ✅ Removed `decoration-manager.ts` and `comment-decoration.ts` (replaced by Comments API)
- ✅ `CommentingRangeProvider` enables gutter `+` on markdown files
- ✅ 126 tests, 97.56% coverage
- Sentinel: ⚠️ CONDITIONAL APPROVE (SENTINEL-2025-0715-CTS-001) — cache hoisting tracked for Increment 3

#### Increment 3: Comment Lifecycle & Refresh ✅ COMPLETE

Keep comment threads in sync with editor state.

- ✅ Hoisted `PrService` and `CommentThreadSync` to `activate()` scope — cache persists across editor changes (SENTINEL-2025-0715-CTS-001 🟡 resolved)
- ✅ `MAX_PAGES = 10` safety bound on `PrService.listReviewComments` pagination (1,000 comments max)
- ✅ Cache-first display: show cached threads instantly on tab switch, refresh in background
- ✅ Token-change detection: recreates services when GitHub auth token changes
- ✅ Lifecycle handlers: `onDidSaveTextDocument` (re-sync), `onDidCloseTextDocument` (clear threads), `onDidChangeSessions` (clear threads + highlights, invalidate cache, re-sync)
- ✅ 160 tests, 87.15% statements, 100% functions
- ✅ Test plan: 18 tests (10 unit, 7 integration, 3 manual) — all verified
- Sentinel: ✅ APPROVED (SENTINEL-2026-0331-HSV-001), ⚠️ CONDITIONAL APPROVE (SNTNL-20260401-001)
- Bugs found during testing: auth change not clearing threads (fixed), auth change not clearing highlights (fixed)

#### Increment 4: Comments Sidebar (TreeView) ✅ COMPLETE

Implement the contributed `gitnotateComments` view.

- ✅ `CommentsTreeProvider` via `createTreeView()` — FileItem/CommentItem/MessageItem tree structure
- ✅ All PR comments shown: both `^gn` sub-line and regular line comments, grouped by file
- ✅ Click-to-navigate: opens file at annotated range + reveals comment thread (`revealThread`)
- ✅ `EventEmitter` for selective refresh, manual refresh button in view title bar
- ✅ State messages: loading, no PR, no auth, no comments
- ✅ Context keys: `gitnotate.hasPR`, `gitnotate.hasComments` for `when` clauses
- ✅ Git branch change detection: `repository.state.onDidChange` re-syncs sidebar automatically
- ✅ Auth state handling: sign-in shows "Loading" + triggers sync, sign-out shows "Sign in"
- ✅ Activity bar icon: monochrome adaptation of official Gitnotate pin icon
- ✅ 217 unit tests (87.7% coverage), 22 integration tests, 36/36 test plan items verified
- Sentinel: ⚠️ CONDITIONAL APPROVE (SENTINEL-20250713-CSB-001), ⚠️ CONDITIONAL APPROVE (SENTINEL-20250720-TST-001)
- Bugs found during testing: comment thread not revealed on navigate (fixed), auth always set noAuth (fixed), no re-sync on branch switch (fixed), Loading stuck without markdown editor (fixed)

#### Increment 5: UX Polish & Integration ✅ COMPLETE

Full round-trip polish, live sync, side-aware rendering, and GH PR extension coexistence.

- ✅ Live comment updates via ETag-based polling: auto-refresh comments when new comments or replies are posted on github.com — poll every 30s (configurable) while a PR file is active, pause on window blur, resume on focus with immediate fetch; use `If-None-Match`/`304 Not Modified` conditional requests to minimize API usage
- ✅ Side-aware comment placement in diff views: respect the `L`/`R` side field in `^gn` metadata and `LEFT`/`RIGHT` from GitHub API — detect diff context via document URI scheme (`git:` = old/LEFT, `file:` = new/RIGHT), filter comments to the correct side; detect cursor side when posting instead of hardcoding RIGHT; add `[Old]`/`[New]` indicators in sidebar
- ✅ Post-comment → refresh decorations + sidebar
- ✅ Reply/resolve handlers on comment threads
- ✅ Use "create a review" API endpoint to avoid `pending review` conflict (GitHub API quirk: single-comment endpoint fails when a pending review exists; the reviews endpoint handles this correctly)
- ✅ Status bar: "Gitnotate: PR #N" with auto-refresh
- ✅ Bidirectional sidebar navigation: clicking a comment thread in the editor reveals it in the sidebar (`treeView.reveal()`)
- ✅ Right-click context menu: "Gitnotate: Add Comment" on text selection
- ✅ Error UX with action buttons ("Sign in to GitHub")
- ✅ Output channel (`Gitnotate`) for debugging
- ✅ Diff-aware anchor resolution: track line deltas via `onDidChangeTextDocument` so `^gn` threads follow text through local edits (moved from Phase 3 — critical for usable save-after-edit experience)

### Phase 2: Full Sidecar Mode (persistent comments outside PRs) 🔮 PLANNED

**Deliverable:** Sidecar file support in both extensions

- Define JSON schema for `.comments/*.json` sidecar files
- Build W3C TextQuoteSelector anchor engine (exact + prefix/suffix matching)
- Support commenting on rendered markdown file views in browser (not just PR diffs)
- Support commenting on markdown files in VSCode editor (not just PR diffs)
- Richer sidebar panel with threading, resolve, filter, navigation
- Write comments as commits to `.comments/` via GitHub API (browser) or filesystem (VSCode)

### Phase 3: Enhanced Extensions 🔮 PLANNED

- Comment notifications / badges
- Support for PR-specific comment branches
- Keyboard shortcuts
- Settings: auto-commit vs. batch commit, branch selection
- "Suggest edit" comment type (like Word Track Changes)

### Phase 4: GitHub Action (Optional) 🔮 PLANNED

- Render `.comments/` content as PR review comments
- Validate anchor integrity on markdown changes
- Comment summary in PR description

---

## Key Design Decisions

1. **`^gn` metadata format**: `^gn:LINE:SIDE:START:END` plain text in PR comments (caret prefix avoids GitHub @mention conflicts)
2. **Storage location for sidecar**: `.comments/` directory (hidden dot-prefix)
3. **Commit strategy**: Auto-commit each comment vs. batch/manual commit
4. **Branch strategy**: Comments on same branch vs. separate comments branch
5. **Auth**: GitHub OAuth App vs. Personal Access Token — **deferred** (not needed for Phase 1's DOM-based approach; revisit when Phase 1.5/2 require API access)
6. **Conflict handling**: Behavior when two people comment on overlapping text simultaneously
7. **Anchor resilience**: How aggressively to fuzzy-match when exact text changes

---

## Future Improvements

- **Overlapping highlight support**: When multiple comments highlight overlapping text ranges on the same line, implement character-level painting instead of `surroundContents`. Each character position would be painted with the union of all highlights covering it, with overlapping regions showing a slightly darker highlight and multiple comment IDs.

- **Hide `^gn` metadata from VSCode Comments panel preview**: The built-in Comments panel (View → Comments) aggregates threads from all extensions. The GitHub PR extension shows raw `^gn:LINE:SIDE:START:END` metadata in its thread previews because it doesn't parse our format. Options: move metadata to last line (so first-line preview is clean), use HTML comments (`<!-- ^gn:... -->`), or coordinate with GH PR extension. Our Gitnotate sidebar already shows clean labels.

---

## Feature Comparison Matrix

| Feature | Word | Google Docs | GitHub (current) | Gitnotate (goal) |
|---|---|---|---|---|
| Text-range selection | ✅ Any range | ✅ Any range | ❌ Line-only | ✅ Any range |
| Sub-line anchoring | ✅ Character-level | ✅ Character-level | ❌ | ✅ Text quote |
| Threaded replies | ✅ | ✅ | ✅ (in PRs) | ✅ |
| Resolve/reopen | ✅ | ✅ | ✅ (in PRs) | ✅ |
| @mentions | ✅ | ✅ | ✅ | ✅ (GitHub handles) |
| Suggest edits | ✅ (Track Changes) | ✅ (Suggesting mode) | ✅ (PR suggestions) | 🔮 Phase 3+ |
| Margin/sidebar view | ✅ | ✅ | N/A | ✅ Sidebar |
| Version history | ✅ (Word versions) | ✅ (auto-save) | ✅ (git) | ✅ (git commits) |
| Non-destructive | ✅ | ✅ | ✅ | ✅ (sidecar file) |
| AI-agent friendly | ❌ (binary format) | ❌ (proprietary API) | ⚠️ (line-level API) | ✅ (JSON in repo) |
| Offline / no vendor | ❌ (needs Word) | ❌ (needs Google) | ⚠️ (needs GitHub) | ✅ (JSON files) |
| Filter by author | ✅ | ✅ | ❌ | ✅ |
| Navigate prev/next | ✅ | ✅ | ❌ | ✅ |
