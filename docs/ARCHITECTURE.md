# Architecture

> Extended architectural context for AI agents. Referenced from AGENTS.md.
>
> **Status:** Reflects v0.1.0 — Phase 1 (PR diff sub-line commenting via DOM manipulation).

---

## Project Structure

```
gitnotate/
├── packages/
│   ├── core/                    ← Shared core library
│   │   ├── src/
│   │   │   ├── parser.ts        ← ^gn metadata parser
│   │   │   └── ...              ← Other shared utilities
│   │   └── tests/
│   ├── browser-extension/       ← Chrome/Edge Manifest V3 extension (v0.1.0 shipped)
│   │   ├── src/
│   │   │   ├── content/         ← Content scripts (github.com)
│   │   │   │   ├── index.ts              ← Orchestration entry point
│   │   │   │   ├── detector.ts           ← GitHub page type detection
│   │   │   │   ├── selection.ts          ← Text selection in diffs
│   │   │   │   ├── textarea-target.ts    ← Finds closest textarea, injects ^gn metadata
│   │   │   │   ├── comment-scanner.ts    ← Scans rendered comments for ^gn tags
│   │   │   │   ├── highlighter.ts        ← Sub-line highlight rendering
│   │   │   │   ├── highlighter.css       ← Highlight styles
│   │   │   │   ├── metadata-hider.ts     ← Hides ^gn metadata in rendered comments
│   │   │   │   ├── thread-colorizer.ts   ← Colors comment threads to match highlights
│   │   │   │   ├── diff-observer.ts      ← Watches for diff content loading
│   │   │   │   ├── observer-lifecycle.ts ← Cleanup for observers/timers
│   │   │   │   ├── github-selectors.ts   ← Centralized DOM selector list
│   │   │   │   ├── logger.ts             ← Debug logging
│   │   │   │   ├── metadata-store.ts     ← WeakMap metadata store
│   │   │   │   └── ui/
│   │   │   │       ├── optin-banner.ts   ← Opt-in banner for new repos
│   │   │   │       └── optin-banner.css
│   │   │   ├── background/
│   │   │   │   └── service-worker.ts     ← Minimal service worker
│   │   │   ├── popup/
│   │   │   │   ├── popup.ts              ← Extension popup logic
│   │   │   │   ├── popup.html
│   │   │   │   └── popup.css
│   │   │   └── storage/
│   │   │       ├── repo-settings.ts      ← Per-repo enable/disable/block
│   │   │       └── highlight-style.ts    ← Highlight style preference
│   │   ├── manifest.json
│   │   └── tests/
│   ├── vscode-extension/        ← VSCode extension (planned — not yet released)
│   │   └── ...
│   └── github-action/           ← GitHub Action (planned — not yet released)
│       └── ...
├── docs/                        ← Associated documentation
│   ├── ARCHITECTURE.md          ← This file
│   ├── DEVELOPMENT-WORKFLOW.md  ← Branching, worktrees, PR process
│   ├── SENTINEL.md              ← Quality gate specification
│   ├── TESTING-STRATEGY.md      ← Test types, coverage, patterns
│   └── internal/                ← Internal docs (test plans, etc.)
├── AGENTS.md                    ← Agent instructions (MUST rules)
├── ROADMAP.md                   ← Project phases and implementation plan
├── DECISIONS.md                 ← Architecture Decision Records
├── LEARNINGS.md                 ← Agent-discovered knowledge
├── CHANGELOG.md                 ← Release history
├── LICENSE                      ← MIT
├── README.md
├── package.json                 ← Monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json           ← Shared TypeScript config
└── eslint.config.js             ← Shared ESLint config
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo strategy | pnpm workspaces | Shared core library across packages |
| `^gn` metadata format | `^gn:LINE:SIDE:START:END` in PR comment text | Zero infrastructure, purely DOM-based, graceful degradation without extension |
| Operation model | DOM manipulation only — zero network requests | No auth needed, no API keys, no permissions beyond content script |
| Build tool | Vite (browser extension) | Fast builds, good TypeScript support, tree-shaking |
| TypeScript config | Strict mode, ES2022 target, ESNext modules, bundler resolution | Maximum type safety, modern output |

## Module Boundaries

- `core/` — Shared logic (metadata parsing). No dependencies on browser APIs, VSCode APIs, or GitHub API. Pure TypeScript.
- `browser-extension/` — Depends on `core/`. Content scripts for github.com that enable sub-line text selection in PR diffs, `^gn` metadata injection into comment textareas, highlight rendering, and metadata hiding. Purely DOM-based — makes zero network requests. Uses Manifest V3, Chrome extension APIs.
- `vscode-extension/` — Planned, not yet released. Will depend on `core/`.
- `github-action/` — Planned, not yet released. Will depend on `core/`.

## Data Flow

### PR Diff Sub-Line Comment Flow (Phase 1 — DOM-based)
1. User selects text within a PR diff line → `selection.ts` captures the selection range (line number, start/end offsets)
2. `textarea-target.ts` finds the closest GitHub comment textarea and injects `^gn:LINE:SIDE:START:END` metadata into the comment text
3. User submits the comment normally through GitHub's own UI — the extension makes no API calls
4. On page load / diff expansion, `comment-scanner.ts` scans rendered comments for `^gn` metadata tags
5. `highlighter.ts` renders highlight spans over the exact text ranges in the diff
6. `metadata-hider.ts` hides the raw `^gn:LINE:SIDE:START:END` text in rendered comments so it doesn't clutter the view
7. `thread-colorizer.ts` colors comment thread markers to match their corresponding highlights
8. `diff-observer.ts` watches for dynamically loaded diff content and re-triggers scanning/highlighting

### Key Characteristics
- **No authentication** — the extension never contacts GitHub's API
- **No sidecar files** — annotations live entirely in PR comment text
- **Graceful degradation** — without the extension, `^gn` metadata is visible but harmless plain text
- **Per-repo opt-in** — `repo-settings.ts` + `optin-banner.ts` manage per-repo enable/disable/block preferences stored via `chrome.storage`

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/parser.ts` | Parses `^gn:LINE:SIDE:START:END` metadata from comment text |
| `packages/browser-extension/manifest.json` | Extension manifest (permissions, content scripts) |
| `packages/browser-extension/src/content/index.ts` | Content script orchestration entry point |
| `packages/browser-extension/src/content/detector.ts` | Detects GitHub page type (PR diff, file view, etc.) |
| `packages/browser-extension/src/content/selection.ts` | Captures text selection in PR diffs |
| `packages/browser-extension/src/content/textarea-target.ts` | Injects `^gn` metadata into comment textareas |
| `packages/browser-extension/src/content/comment-scanner.ts` | Scans rendered comments for `^gn` tags |
| `packages/browser-extension/src/content/highlighter.ts` | Renders sub-line highlights in diff views |
| `packages/browser-extension/src/content/metadata-hider.ts` | Hides `^gn` metadata in rendered comments |
| `packages/browser-extension/src/content/thread-colorizer.ts` | Colors comment threads to match highlights |
| `packages/browser-extension/src/content/diff-observer.ts` | MutationObserver for dynamically loaded diffs |
| `packages/browser-extension/src/content/github-selectors.ts` | Centralized GitHub DOM selectors |
| `packages/browser-extension/src/content/metadata-store.ts` | WeakMap-based metadata store |
| `packages/browser-extension/src/storage/repo-settings.ts` | Per-repo enable/disable/block settings |
| `packages/browser-extension/src/popup/popup.ts` | Extension popup UI logic |
| `packages/browser-extension/src/background/service-worker.ts` | Minimal Manifest V3 service worker |
