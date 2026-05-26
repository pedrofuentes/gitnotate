# Architecture Decision Records — Gitnotate

> **Record every significant technical decision here.** When choosing between approaches,
> document what was chosen and why. This prevents future agents and developers from
> re-debating settled decisions or accidentally reversing them.
>
> Do NOT write decisions to AGENTS.md — they belong here.

## Format

```markdown
### ADR-NNN: Decision Title
**Date**: YYYY-MM-DD
**Status**: Proposed / Accepted / Superseded by ADR-NNN
**Context**: What problem or question prompted this decision?
**Decision**: What was decided?
**Alternatives considered**: What other options were evaluated?
**Consequences**: What are the trade-offs? What does this enable or prevent?
```

## Decisions

<!-- Add new decisions below this line, most recent first -->

### ADR-001: Monorepo with pnpm Workspaces
**Date**: 2026-03-27
**Status**: Accepted
**Context**: Gitnotate has shared core logic used by both a browser extension and a VSCode extension. Code duplication across separate repos would be a maintenance burden.
**Decision**: Use a pnpm workspaces monorepo with a shared `packages/core/` library.
**Alternatives considered**: Separate repos with npm package publishing; single-repo without workspaces.
**Consequences**: Enables atomic cross-package changes and shared TypeScript types. Requires pnpm workspace awareness in CI and build tooling.

### ADR-002: `^gn` Metadata in PR Comments
**Date**: 2026-03-27 (updated 2026-03-29)
**Status**: Accepted (supersedes original `@gn` format)
**Context**: Need a way to store sub-line comment anchoring data within GitHub's existing PR comment system without requiring extra infrastructure. The original `@gn` prefix conflicted with GitHub's user mention system.
**Decision**: Embed `^gn:LINE:SIDE:START:END` plain-text metadata in comment bodies. The caret prefix (`^`) avoids GitHub @mention conflicts. Line number is embedded in the metadata so the scanner doesn't need fragile DOM inference. Metadata is visually hidden in submitted comments but preserved in the edit source.
**Alternatives considered**: `@gn` (conflicts with @mentions); HTML comments `<!-- -->` (stripped by GitHub security); backtick-wrapped code spans (stripped from textContent in rendered comments).
**Consequences**: Zero infrastructure, metadata survives GitHub rendering. Line number in metadata makes scanning reliable across UI changes. Breaking change from old 2-field format — old comments won't highlight.

### ADR-003: W3C TextQuoteSelector for Sidecar Anchoring
**Date**: 2026-03-27
**Status**: Accepted
**Context**: Sidecar files need resilient text anchoring that survives nearby edits to the document.
**Decision**: Use W3C TextQuoteSelector pattern (`exact` + `prefix` + `suffix` context) for anchor resolution.
**Alternatives considered**: Character offsets only; line numbers; CriticMarkup-style inline syntax.
**Consequences**: More resilient to edits than offsets. Requires fuzzy matching logic. Aligns with web annotation standards.

### ADR-004: GitHub OAuth with PAT Fallback
**Date**: 2026-03-27
**Status**: Superseded — Deferred to Phase 2. The v0.1.0 browser extension is purely DOM-based and does not require authentication or API access.
**Context**: Browser extension needs authenticated GitHub API access for creating PR comments.
**Decision**: Primary auth via GitHub OAuth App; Personal Access Token as fallback.
**Alternatives considered**: PAT only; GitHub App installation tokens.
**Consequences**: OAuth provides better UX for most users. PAT fallback supports enterprise/restricted environments.

### ADR-005: Independent Versioning with Release Please
**Date**: 2026-05-25
**Status**: Accepted
**Context**: The monorepo ships two user-facing products — a browser extension and a VSCode extension — that evolve on independent timelines. A single version number would force synchronized releases even when only one package has changes. We also needed automated changelog generation and version bumping from conventional commits.
**Decision**: Version browser-extension and vscode-extension independently using [Release Please](https://github.com/googleapis/release-please). Each package gets its own Release Please component, separate version-bump PRs, and independent changelogs. Release Please is configured with `skip-github-release: true` — it only creates version-bump PRs (updating `package.json`, `CHANGELOG.md`, and `.release-please-manifest.json`). After merging a Release Please PR, a developer manually creates a tag (`browser-vX.Y.Z` or `vscode-vX.Y.Z`) to trigger the corresponding release workflow.
**Alternatives considered**: Single version for all packages (forces unnecessary releases); fully automated releases via Release Please GitHub releases (tags created by `GITHUB_TOKEN` don't trigger other workflows, would require a PAT); manual versioning without automation (error-prone, no changelog generation).
**Consequences**: Each package can release independently without coordinating versions. Changelogs are generated automatically from conventional commits. The manual tagging step is intentional — it gives developers a final gate before publishing to the Chrome Web Store and VS Code Marketplace. Tag naming convention (`browser-v*`, `vscode-v*`) matches existing release workflows. Internal packages (`core`, `github-action`) are not configured for Release Please since they are not published independently.
