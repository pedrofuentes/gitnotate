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

> **Not yet released:** The VSCode extension (`packages/vscode-extension`) and
> GitHub Action (`packages/github-action`) are planned for Phase 2 and are not
> included in the v0.1.0 release.
