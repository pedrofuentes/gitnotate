# Changelog — Gitnotate

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (VSCode Extension — Phase 1.5 Increment 3)
- Cache-first comment thread display — cached threads render instantly on tab switch, then refresh in background
- `MAX_PAGES = 10` safety bound on PR comment pagination (caps at 1,000 comments)
- Lifecycle handler: `onDidSaveTextDocument` — re-syncs comment threads when a markdown file is saved
- Lifecycle handler: `onDidCloseTextDocument` — clears comment threads when a markdown tab is closed
- Lifecycle handler: `onDidChangeSessions` — clears threads/highlights and re-syncs when GitHub auth changes
- 25 new automated tests (160 total), integration test suites 17–22

## [0.2.0] — 2026-04-03

### Added (Browser Extension)
- **Conversation-view support** — ^gn comments are now processed on the PR Conversation tab (`/pull/N`), not just the Changes/Files tab
- Scan for ^gn metadata in conversation timeline threads
- Hide metadata text from rendered comment bodies in conversation view
- Highlight the referenced character range in each thread's code snippet
- Colorize comment threads to match highlight colors
- DOM mutation observer for lazily-loaded timeline items
- 18 new tests for conversation-view processing (248 total browser extension tests)

### Changed (VSCode Extension)
- `PrService` and `CommentThreadSync` hoisted to module scope — cache persists across editor tab switches (was per-invocation)
- Token-change detection: services are recreated when GitHub auth token changes
- `syncForDocument` refactored — extracted `renderComments()` private method, added `syncForDocumentCacheFirst()` and `getCachedComments()` public methods

### Fixed (VSCode Extension)
- Stale comment threads remained visible after GitHub sign-out (auth handler now calls `clearThreads()`)
- Wavy underline highlights remained visible after GitHub sign-out (auth handler now calls `clearHighlights()`)
- Merge conflict markers from Increment 2 merge resolved on 9 files

### Fixed (Root)
- CVE in `serialize-javascript@6.0.2` — forced `>=7.0.5` via `pnpm.overrides`
- CVE in `diff@7.0.0` — forced `>=8.0.3` via `pnpm.overrides`

## [0.1.0] — 2026-03-29

### Added
- Sub-line text selection and `^gn` metadata injection on PR diff pages
- Proximity-based textarea targeting — metadata injected into the correct comment box by line number
- Multiple pending highlights tracked independently per textarea
- Submitted comment highlighting via `findCodeCell` (supports GitHub's new React diff UI)
- 4-field metadata format `^gn:LINE:SIDE:START:END` with line number and diff side embedded
- Metadata visually hidden in submitted comments (preserved in edit source)
- Distinct highlight colors for multiple comments on the same line (6-color palette)
- Color association between highlights and comment threads (border + author name)
- `data-gn-*` attributes on highlight spans and `<td>` for future use
- Extension icons (16, 32, 48, 128px) — charcoal pin with emerald accent
- GitHub Actions CI/CD — lint, test, build, release, and Pages deploy workflows
- Privacy policy and landing page (GitHub Pages)
- Store listing content for Chrome Web Store and Edge Add-ons
- Build & packaging script (`pnpm package`) — creates versioned zip for store submission
- Release process documentation (`docs/RELEASE.md`)
- 15 manual test cases documented in `docs/TESTING-STRATEGY.md`

### Changed
- Annotation IDs now use `crypto.randomUUID()` (UUID v4 format) instead of `Math.random()`-based 21-char base62 strings — existing annotations are unaffected (IDs are validated as non-empty strings)
- Metadata prefix changed from `@gn` to `^gn` (avoids GitHub @mention conflicts)
- Metadata format changed from 2-field `^gn:START:END` to 4-field `^gn:LINE:SIDE:START:END`
- Backticks removed from metadata tags (plain text instead of code spans)
- Scanner reads line number from metadata instead of fragile DOM inference
- Double-init prevention via AbortController instead of boolean flag
- ESLint config: added `varsIgnorePattern` and `destructuredArrayIgnorePattern`

### Fixed
- Wrong textarea gets metadata when multiple comment boxes are open
- Submitted comments not highlighted (parser, scanner, highlighter updated for GitHub's new React UI)
- Off-by-one line matching in split-view diffs
- Double event handler registration on turbo:load navigation
- Metadata accidentally hidden inside pending textareas
- ESLint not running (missing root dependencies)
- Unused import lint errors across packages

### Removed
- Legacy `<!-- @gn {...} -->` HTML comment format (superseded by `^gn:LINE:SIDE:START:END`)
- `resolveLineNumber()` DOM walker in scanner (replaced by metadata-embedded line number)
