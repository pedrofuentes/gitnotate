# Architecture

> Extended architectural context for AI agents. Referenced from AGENTS.md.

---

## Project Structure

```
gitnotate/
├── packages/
│   ├── core/                    ← Shared core library
│   │   ├── src/
│   │   │   ├── metadata/        ← @gn metadata parser/writer
│   │   │   ├── anchor/          ← TextQuoteSelector anchor engine
│   │   │   ├── schema/          ← JSON schema validation, sidecar CRUD
│   │   │   └── index.ts         ← Public API barrel export
│   │   └── tests/
│   ├── browser-extension/       ← Chrome/Edge Manifest V3 extension
│   │   ├── src/
│   │   │   ├── auth/            ← GitHub OAuth + API client
│   │   │   ├── content/         ← Content scripts (github.com)
│   │   │   │   ├── ui/          ← UI components (comment button, highlights)
│   │   │   │   ├── detector.ts  ← PR diff page detection
│   │   │   │   ├── selection.ts ← Text selection handling
│   │   │   │   ├── highlighter.ts ← Sub-line highlight rendering
│   │   │   │   ├── comment-scanner.ts  ← @gn metadata extraction from comments
│   │   │   │   ├── comment-submitter.ts ← GitHub API comment creation
│   │   │   │   ├── diff-observer.ts    ← MutationObserver for dynamic diff loading
│   │   │   │   ├── file-view-handler.ts ← File view page handling
│   │   │   │   └── sidecar-client.ts   ← Sidecar file read/write
│   │   │   ├── background/      ← Service worker
│   │   │   ├── popup/           ← Extension popup UI
│   │   │   └── storage/         ← Repo settings persistence
│   │   ├── manifest.json
│   │   └── tests/
│   ├── vscode-extension/        ← VSCode extension
│   │   ├── src/
│   │   │   ├── extension.ts     ← Extension entry point
│   │   │   ├── comment-command.ts     ← PR comment commands
│   │   │   ├── file-comment-command.ts ← File-level comment commands
│   │   │   ├── comment-decoration.ts  ← Comment display decorations
│   │   │   ├── decoration-manager.ts  ← Decoration lifecycle management
│   │   │   ├── pr-detector.ts         ← PR context detection
│   │   │   ├── github-api.ts          ← GitHub API client
│   │   │   ├── sidecar-provider.ts    ← Sidecar file provider
│   │   │   └── settings.ts           ← Extension settings
│   │   └── tests/
│   └── github-action/           ← GitHub Action for CI integration
│       ├── src/
│       │   ├── index.ts              ← Action entry point
│       │   ├── anchor-validator.ts   ← Validates anchors against markdown
│       │   └── summary-reporter.ts   ← PR summary report generation
│       ├── action.yml
│       └── tests/
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
| Monorepo strategy | pnpm workspaces | Shared core library between browser extension, VSCode extension, and GitHub Action |
| `@gn` metadata format | `<!-- @gn {...} -->` in PR comments | Zero infrastructure, graceful degradation without extension, uses all GitHub features |
| Anchor strategy (sidecar) | W3C TextQuoteSelector (`exact` + `prefix`/`suffix`) | Resilient to nearby edits, aligns with web annotation standards |
| GitHub API | REST API for PR comment CRUD, Contents API for sidecar file read/write | Widely supported, well-documented, works with both OAuth and PAT |
| Auth | GitHub OAuth App + PAT fallback | Best UX for most users, PAT covers enterprise environments |
| Sidecar storage | `.comments/document.md.json` files in repo | Git-native, no external infrastructure, versioned with content |
| Build tool | Vite (browser extension), esbuild (action) | Fast builds, good TypeScript support, tree-shaking |
| TypeScript config | Strict mode, ES2022 target, ESNext modules, bundler resolution | Maximum type safety, modern output |

## Module Boundaries

- `core/` — Shared logic (metadata parsing/building, anchor engine, schema validation). No dependencies on browser APIs, VSCode APIs, or GitHub API. Pure TypeScript.
- `browser-extension/` — Depends on `core/`. Provides content scripts for github.com that enable sub-line text selection, comment creation with `@gn` metadata, and highlight rendering. Uses Manifest V3, Chrome extension APIs.
- `vscode-extension/` — Depends on `core/`. Provides VSCode extension that integrates sub-line commenting into VSCode's diff view and editor. Uses VSCode Extension API.
- `github-action/` — Depends on `core/`. GitHub Action that validates anchor integrity when markdown files change and generates PR summary reports.

## Data Flow

### PR Comment Flow (Tier 1 — Lightweight Mode)
1. User selects text within a PR diff line → browser extension captures selection range
2. Extension creates a standard GitHub PR line comment via REST API
3. Comment body contains `<!-- @gn {"exact":"selected text","start":N,"end":M} -->` metadata
4. On page load, extension scans existing comments for `@gn` metadata
5. For each `@gn` comment, extension highlights the exact text range in the diff

### Sidecar Flow (Tier 2 — Full Mode, Phase 2)
1. User selects text in a rendered markdown file → extension captures selection
2. Extension creates a W3C TextQuoteSelector anchor with `exact`, `prefix`, `suffix`
3. Annotation stored in `.comments/filename.md.json` sidecar file
4. Sidecar file committed to repo via GitHub Contents API or filesystem
5. On file view, extension reads sidecar, resolves anchors, renders highlights

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/metadata/parser.ts` | Parses `@gn` metadata from PR comment bodies |
| `packages/core/src/metadata/builder.ts` | Builds PR comment bodies with `@gn` metadata |
| `packages/core/src/anchor/engine.ts` | TextQuoteSelector anchor resolution engine |
| `packages/core/src/schema/validation.ts` | JSON schema validation for sidecar files |
| `packages/browser-extension/manifest.json` | Extension manifest (permissions, content scripts) |
| `packages/browser-extension/src/content/index.ts` | Content script entry point |
| `packages/browser-extension/src/content/selection.ts` | Text selection handling in PR diffs |
| `packages/vscode-extension/src/extension.ts` | VSCode extension entry point |
| `packages/github-action/action.yml` | GitHub Action definition |
