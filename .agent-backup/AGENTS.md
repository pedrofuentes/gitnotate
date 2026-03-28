# AGENTS.md — Instructions for AI Agents Working on Gitnotate

> This file contains mandatory instructions for any AI agent contributing to the Gitnotate project.
> **All agents MUST read and follow these instructions before making any changes.**

---

## Project Overview

**Gitnotate** (git + annotate) — A browser extension and VSCode extension for sub-line commenting on Markdown files in GitHub PR reviews.

- **Repository**: https://github.com/pedrofuentes/gitnotate
- **License**: MIT
- **Tech stack**: TypeScript, Manifest V3 (Chrome/Edge), VSCode Extension API, GitHub REST API
- **Roadmap**: See [ROADMAP.md](./ROADMAP.md) for full architecture, research, and implementation phases

---

## Mandatory Development Practices

### 1. Test-Driven Development (TDD) — REQUIRED

Every feature and bugfix **MUST** follow TDD:

1. **Write failing tests first** — Define the expected behavior before writing any implementation code
2. **Write minimal implementation** — Make the tests pass with the simplest code that works
3. **Refactor** — Clean up while keeping tests green

**No implementation code may be written without a corresponding test written first.**

Test types required:
- **Unit tests**: For all core logic (anchor engine, metadata parser, schema validation)
- **Integration tests**: For GitHub API interactions, DOM manipulation, extension lifecycle
- **E2E tests**: For critical user flows (text selection → comment creation → highlight rendering)

### 2. Incremental Development — REQUIRED

Work in small, reviewable increments:

- Each PR should represent a single logical change (one feature, one bugfix, one refactor)
- Prefer many small PRs over few large ones
- Each increment must be independently testable and deployable
- Never submit a PR with mixed concerns (e.g., feature + unrelated refactor)

### 3. GitHub Flow Branching Model — REQUIRED

**Never work directly on `main`.** The `main` branch is always deployable.

Workflow:
1. Create a feature branch from `main`: `git checkout -b feature/short-description`
2. Make commits with clear, descriptive messages
3. Push the branch and open a Pull Request
4. After review and approval, merge to `main`
5. Delete the feature branch after merge

Branch naming conventions:
- `feature/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring
- `docs/description` — Documentation changes
- `test/description` — Test additions or fixes
- `chore/description` — Build, CI, dependency updates

### 4. Git Worktrees for Parallel Agent Work

When multiple agents need to work simultaneously on independent tasks:

- Use `git worktree` to create isolated working directories
- Each agent works in its own worktree on its own branch
- This avoids conflicts between concurrent agents
- Worktrees share the same git repository but have independent working directories

```bash
# Create a worktree for a specific feature
git worktree add ../gitnotate-feature-name feature/feature-name

# List active worktrees
git worktree list

# Remove a worktree when done
git worktree remove ../gitnotate-feature-name
```

### 5. Commit Message Format

Follow conventional commits:

```
type(scope): short description

Longer description if needed.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`, `perf`

---

## Pre-Merge Review Process — REQUIRED

**Before any code is merged to `main`**, after the implementing agent confirms the code works and the user approves, a panel of specialized review sub-agents **MUST** be run. All issues found must be addressed before merging.

### Review Sub-Agent Panel

The following 9 specialized review agents must be run in parallel on every PR before merge:

---

### 1. Security Review Agent

Responsibilities:
- Audit for injection vulnerabilities (SQL, XSS, command injection, path traversal)
- Check authentication and authorization logic for flaws
- Look for hardcoded secrets, credentials, or API keys
- Review input validation and sanitization
- Check for insecure cryptographic practices or weak hashing
- Identify CSRF, SSRF, and insecure deserialization risks
- Review dependency supply chain risks (known CVEs in deps)

---

### 2. Performance Review Agent

Responsibilities:
- Identify N+1 queries, missing indexes, or expensive DB operations
- Look for memory leaks, unbounded caches, or resource exhaustion risks
- Review algorithmic complexity — flag O(n²) or worse in hot paths
- Check for unnecessary synchronous blocking or missing concurrency
- Identify redundant computations, repeated allocations, or missing memoization
- Review network calls for missing timeouts, retries, or connection pooling

---

### 3. Error Handling & Resilience Review Agent

Responsibilities:
- Check for swallowed exceptions or empty catch blocks
- Review error propagation — are errors lost, wrapped properly, or logged?
- Look for missing retry logic, circuit breakers, or graceful degradation
- Identify operations that could leave the system in an inconsistent state on failure
- Check that external service failures are handled without cascading crashes
- Review logging — is there enough context to diagnose production issues?

---

### 4. Reusability & Architecture Review Agent

Responsibilities:
- Identify duplicated logic that should be extracted into shared modules
- Review module boundaries — are concerns properly separated?
- Check for tight coupling that makes components hard to reuse independently
- Look for god classes, god functions, or modules with too many responsibilities
- Evaluate abstraction quality — are interfaces well-defined and stable?
- Check for proper use of design patterns where appropriate

---

### 5. Testability Review Agent

Responsibilities:
- Identify code that is hard to test due to tight coupling or hidden dependencies
- Check for proper dependency injection or at least seams for mocking
- Look for static/global state that makes tests non-deterministic
- Review whether side effects are isolated and controllable in tests
- Check for functions with too many responsibilities that are hard to unit test
- Identify missing interfaces or abstraction layers that would improve testability

---

### 6. Test Coverage & Quality Review Agent

Responsibilities:
- Identify critical paths, business logic, and edge cases lacking test coverage
- Review existing tests for assertion quality — do they test behavior or just structure?
- Look for flaky tests, tests with external dependencies, or non-deterministic tests
- Check that error paths and failure modes are tested, not just happy paths
- Review test organization — are tests readable, well-named, and maintainable?
- Identify integration test gaps for cross-component interactions

---

### 7. Regression Risk Review Agent

Responsibilities:
- Identify fragile code areas where small changes could break unrelated functionality
- Look for implicit dependencies or assumptions between modules
- Check for missing contract tests or API versioning concerns
- Review backward compatibility of any public APIs or shared interfaces
- Identify areas with high change frequency but low test coverage
- Flag code with complex conditional logic prone to subtle regressions

---

### 8. API Design & Contract Review Agent

Responsibilities:
- Review API endpoint naming, HTTP method usage, and response consistency
- Check for proper versioning, deprecation strategies, and backward compatibility
- Look for inconsistent error response formats or missing status codes
- Review request/response validation and documentation accuracy
- Check for proper pagination, rate limiting, and idempotency where needed
- Identify breaking changes or undocumented behaviors

---

### 9. Dependency & Supply Chain Review Agent

Responsibilities:
- Check for outdated dependencies with known vulnerabilities
- Look for abandoned or unmaintained packages in the dependency tree
- Review license compatibility across all dependencies (must be MIT-compatible)
- Identify unnecessary or bloated dependencies that could be replaced
- Check for pinned versions vs floating ranges and lockfile hygiene
- Review build and CI pipeline dependencies for security risks

---

## Review Process Workflow

```
Agent implements feature (TDD, incremental, on feature branch)
    ↓
All tests pass, user confirms it works
    ↓
Open PR from feature branch → main
    ↓
Run all 9 review sub-agents in parallel on the PR
    ↓
Address all findings (fix code, update tests)
    ↓
Re-run any affected review agents to confirm fixes
    ↓
All agents approve → Merge to main
```

---

## Code Style & Standards

- **Language**: TypeScript (strict mode enabled)
- **Formatting**: Prettier (configured in project)
- **Linting**: ESLint with TypeScript rules
- **Testing framework**: Vitest (or Jest) for unit/integration, Playwright for E2E
- **Module system**: ES modules
- **Minimum Node.js version**: 18+

---

## Project Structure (Target)

```
gitnotate/
├── packages/
│   ├── core/                    ← Shared core library
│   │   ├── src/
│   │   │   ├── metadata/        ← @gn metadata parser/writer
│   │   │   ├── anchor/          ← TextQuoteSelector anchor engine
│   │   │   ├── schema/          ← JSON schema validation
│   │   │   └── types/           ← Shared TypeScript types
│   │   └── tests/
│   ├── browser-extension/       ← Chrome/Edge Manifest V3 extension
│   │   ├── src/
│   │   │   ├── content/         ← Content scripts (github.com)
│   │   │   ├── background/      ← Service worker
│   │   │   ├── popup/           ← Extension popup UI
│   │   │   └── api/             ← GitHub API client
│   │   ├── manifest.json
│   │   └── tests/
│   └── vscode-extension/        ← VSCode extension
│       ├── src/
│       └── tests/
├── ROADMAP.md
├── AGENTS.md
├── LICENSE                      ← MIT
├── README.md
└── package.json                 ← Monorepo root (pnpm workspaces)
```

---

## Key Technical Decisions

- **Monorepo**: pnpm workspaces for shared code between browser and VSCode extensions
- **`@gn` metadata format**: Comment bodies include `<!-- @gn {...} -->` hidden metadata + human-readable quoted text fallback
- **GitHub API**: REST API for PR comment CRUD, Contents API for sidecar file read/write
- **Auth**: GitHub OAuth for browser extension, PAT fallback
- **Sidecar files**: `.comments/document.md.json` using W3C TextQuoteSelector anchoring (Phase 2)
