# Development Workflow

> Extended workflow context for AI agents. Referenced from AGENTS.md.
> **The MUST rules (TDD, branching, worktrees, incremental development, Sentinel) are enforced in AGENTS.md.**
> This document covers the detailed HOW.

---

## Git Worktrees for Isolation

Every increment MUST use a git worktree for isolation:

```bash
# Fetch latest main, create worktree with new branch
git fetch origin main
git worktree add ../gitnotate-feature-name -b feature/feature-name main

# Change into the worktree
cd ../gitnotate-feature-name

# If worktree already exists (retry/recovery), just cd into it
# git worktree list  # check existing worktrees

# List active worktrees
git worktree list

# Remove a worktree when done (after merge — cd back to main worktree first)
cd <main-worktree-root>
git worktree remove ../gitnotate-feature-name
git branch -D feature/feature-name
```

### Why Worktrees Are Required
- Prevents interference between parallel work
- Each agent/increment has a clean working directory
- No risk of uncommitted changes from one task affecting another
- Easy cleanup after merge

## Branching Details

### Branch Lifecycle
1. Fetch latest: `git fetch origin main`
2. Create worktree + branch from `main`: `git worktree add ../gitnotate-name -b feature/name main && cd ../gitnotate-name`
3. TDD: write failing tests, implement, refactor
4. Commit following the format in AGENTS.md
5. Push branch: `git push -u origin feature/name`
6. Open PR: `gh pr create` or via GitHub UI
7. Invoke Sentinel for review
8. Address any Sentinel feedback, re-submit
9. On Sentinel approval, merge to `main`
10. Cleanup: `cd <main-root> && git worktree remove ../gitnotate-name && git branch -D feature/name`

### Branch Naming Convention
| Prefix | Use For |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code refactoring |
| `docs/` | Documentation changes |
| `test/` | Test additions or fixes |
| `chore/` | Build, CI, dependency updates |

## Pull Request Process

### Before Opening a PR
1. All tests pass in the worktree
2. Linting passes
3. Commit messages follow the format
4. PR represents a single logical unit

### PR Title Format
`type(scope): Short description`

### Sentinel Review
→ See [`docs/SENTINEL.md`](./SENTINEL.md) for the full process and invocation methods.

### After Merge
```bash
cd <main-worktree-root>
git worktree remove ../gitnotate-feature-name
git branch -D feature/name
git pull origin main
```
- Start next increment from the plan
- If other worktrees are in progress, rebase them: `cd ../gitnotate-other && git fetch origin main && git rebase origin/main`

## Sub-Agent Delegation

### When to Delegate
- Complex research that requires deep analysis
- Documentation generation
- Test data creation or fixture generation
- Performance profiling and optimization analysis
- Security vulnerability assessment

### How to Delegate
- Provide the sub-agent with full context (requirements, constraints, relevant code)
- Each sub-agent works in its own context
- Integrate sub-agent output back into the main work
- All sub-agent output must follow AGENTS.md rules

## Environment Setup

### Prerequisites
- Node.js 18+
- pnpm (install via `npm install -g pnpm`)

### Initial Setup
```bash
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages
pnpm test                       # Run all tests
```

### Package-Specific Development
```bash
# Core library
cd packages/core && pnpm test

# Browser extension (primary — shipped in v0.1.0)
cd packages/browser-extension && pnpm build   # Builds to dist/
# Load dist/ as unpacked extension in Chrome/Edge
```

## Releasing

Gitnotate uses [Release Please](https://github.com/googleapis/release-please) for automated versioning and changelog generation, with manual tagging to trigger release workflows.

### How It Works

```
push to main ──► Release Please creates/updates version-bump PR
                  (bumps package.json, updates CHANGELOG.md)

merge RP PR ──► version bump lands on main

create tag ───► release workflow builds, packages, and publishes
```

The browser extension and VSCode extension are versioned **independently** — each gets its own Release Please PR and changelog (see [ADR-005](./DECISIONS.md#adr-005-independent-versioning-with-release-please)).

### Automated: Version Bump PRs

Release Please runs on every push to `main` and analyzes conventional commit messages:
- `feat(browser):` → minor version bump for browser-extension
- `fix(vscode):` → patch version bump for vscode-extension
- `feat!:` or `BREAKING CHANGE:` → major version bump

It creates (or updates) a PR per component with:
- Updated `package.json` version
- Updated `CHANGELOG.md` with categorized entries
- Updated `.release-please-manifest.json`

> **Note:** Release Please is configured with `skip-github-release: true`. It only creates PRs — it does not create GitHub releases or tags automatically. This is intentional (see ADR-005).

### Manual: Cutting a Release

After merging a Release Please PR, create a tag to trigger the release workflow:

#### Browser Extension
```bash
# Check the version that was just bumped
cat packages/browser-extension/package.json | grep '"version"'

# Create and push the tag
git tag browser-v<VERSION>    # e.g., browser-v0.3.0
git push origin browser-v<VERSION>
```

This triggers `.github/workflows/release.yml`, which:
1. Runs core + browser-extension tests
2. Builds all packages
3. Packages the browser extension as a `.zip`
4. Creates a GitHub Release with the `.zip` attached

#### VSCode Extension
```bash
# Check the version that was just bumped
cat packages/vscode-extension/package.json | grep '"version"'

# Create and push the tag
git tag vscode-v<VERSION>    # e.g., vscode-v0.2.0
git push origin vscode-v<VERSION>
```

This triggers `.github/workflows/release-vscode.yml`, which:
1. Runs core + vscode-extension tests
2. Builds all packages
3. Packages the `.vsix`
4. Publishes to the VS Code Marketplace (requires `VSCE_PAT` secret)
5. Publishes to Open VSX (optional, requires `OVSX_PAT` secret)
6. Creates a GitHub Release with the `.vsix` attached

### Configuration Files

| File | Purpose |
|------|---------|
| `release-please-config.json` | Monorepo config: components, changelog sections, `skip-github-release` |
| `.release-please-manifest.json` | Current versions for each component |
| `.github/workflows/release-please.yml` | Workflow that runs Release Please on push to main |

### Tag Naming Convention

| Package | Tag Pattern | Example |
|---------|------------|---------|
| Browser Extension | `browser-v*` | `browser-v0.3.0` |
| VSCode Extension | `vscode-v*` | `vscode-v0.2.0` |
