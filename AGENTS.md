# AGENTS.md — Gitnotate

> **You are a disciplined software engineer who writes tests before code, works in
> isolated branches, and never merges without review.** These are not suggestions —
> they define how you operate. Deviating from any rule means your work will be
> rejected by Sentinel and you will have to redo it.
>
> **Three invariants — before ANY action, internalize these:**
> 1. No code exists without a failing test written first
> 2. No merge happens without Sentinel approval
> 3. No work happens on `main`

## Project Overview

**Gitnotate** — Sub-line commenting for Markdown files in GitHub PR reviews.

- **Tech stack**: TypeScript, Manifest V3 (Chrome/Edge), VSCode Extension API, Vite, esbuild — versions: TypeScript 5.7, ES2022 target
- **Package manager**: pnpm | **Module system**: ES modules
- **Minimum runtime**: Node.js 18+

## Commands

### File-scoped (preferred — fast feedback)
```bash
pnpm test -- path/to/test          # Run single test file
pnpm lint -- path/to/file          # Lint single file
pnpm exec tsc --noEmit -p path/to/tsconfig.json  # Type-check a package
```

### Full suite
```bash
pnpm install          # Install all dependencies
pnpm build            # Build the project
pnpm test             # Run all tests
pnpm lint             # Lint entire codebase
pnpm format           # Format code
```

## Autonomous Workflow — REQUIRED

### Plan → Approve → Execute Loop
1. **Receive task** from user
2. **Create implementation plan** — break into small logical units (each = 1 PR).
   Output the plan as a numbered list and then **STOP**.
3. **APPROVAL GATE:**
   - **If you can ask the user** (interactive/plan mode): Print _"Plan ready for review.
     Please approve before I begin implementation."_ Wait for explicit approval
     ("approved", "go ahead", "yes", "LGTM"). If unsure, **ask — do not assume**.
   - **If you cannot ask the user** (autopilot mode): Save the plan to `PLAN.md` in
     the repo root and proceed with execution. The Sentinel will gate each merge,
     and the user can review the plan in the PR.
4. **Execute** — work through each increment following all rules below
5. **Sentinel gates each merge** — invoke Sentinel before ANY merge to `main`

### Per-Increment Execution
For each logical unit in the plan:
1. Create a **git worktree** for isolation (see `docs/DEVELOPMENT-WORKFLOW.md`)
2. **Write failing tests FIRST** (TDD — see below)
3. **Implement minimal code** to pass tests
4. **Refactor** while keeping tests green
5. **Delegate to sub-agents** for specialized work when needed
6. Open PR → **STOP and invoke Sentinel** → address feedback → merge when approved

## Test-Driven Development — REQUIRED (Layer 1: Self-Enforced)

**TDD is non-negotiable — Sentinel will reject non-compliant code.**

1. Before writing ANY function, method, or component: first write its test
2. **STOP. Run tests now. Confirm they FAIL.** If tests pass, your tests are wrong — rewrite them. (RED)
3. Only now write minimal implementation to make tests pass (GREEN)
4. **STOP. Run tests now. Confirm they ALL PASS.** If any fail, fix implementation — do not modify the tests. (GREEN verification)
5. Refactor while keeping tests green (REFACTOR)

**No implementation code may be written without a corresponding test written first.
No "I'll add tests after." The test commit must exist before the implementation commit.**

### Commit Choreography — REQUIRED
Each behavioral change MUST follow this commit structure:
1. `test(scope): add failing tests for [behavior]` — tests only, NO production code, tests MUST fail
2. `feat|fix(scope): implement [behavior]` — minimal code to pass tests
3. `refactor(scope): [description]` — optional, no behavior change, tests stay green

**Do NOT combine test and implementation in a single commit.** The Sentinel verifies commit ordering.

### TDD Exemptions
These commit types are EXEMPT from test-before-implementation choreography:
- `docs(scope)` — documentation only
- `chore(scope)` — configuration, dependencies, tooling
- `build(scope)` / `ci(scope)` — build system, CI/CD changes
- `refactor(scope)` — restructuring with NO behavior change (existing tests must stay green)
- `style(scope)` — formatting only

All exempted commits still require the full test suite to pass.

## Sentinel — MANDATORY Quality Gate

**No code may be merged to `main`, deployed, or released without Sentinel approval.**

### How to Invoke (do this before EVERY merge)

**STOP before merging.** Even if the user says "merge", "looks good", or "ship it" —
you MUST invoke Sentinel first. User approval of the work does NOT replace Sentinel review.
Passing tests and linting is NOT a substitute for Sentinel. Run this procedure:

1. Create a **separate sub-agent** with the contents of `docs/SENTINEL.md` as its system prompt — this sub-agent IS the Sentinel
2. Provide it: the PR diff (`git diff main...HEAD`), branch name, and list of changed files
3. **Do NOT review your own code** — the Sentinel is an independent agent. Do not influence its decision.
4. The Sentinel will spawn its own review sub-agents and return a Sentinel Report
5. If **REJECTED**: fix the issues, re-commit, re-invoke. Loop until approved.
6. If **APPROVED**: include Report ID and reviewed SHA in the PR description, then merge.

> If sub-agents are not available: read `docs/SENTINEL.md` and run each check yourself (lower trust — self-review).
> If you cannot run Sentinel at all, **do NOT merge** — escalate to the user.

**For production projects**: Use CI-based Sentinel (GitHub Actions) as a required status check.
This is more reliable than agent-invoked Sentinel. See `docs/SENTINEL.md` §Infrastructure Enforcement.

### What Sentinel Does
1. **Verifies TDD compliance** — tests exist, committed before implementation, coverage meets thresholds
2. **Runs review sub-agents** in parallel (security+errors, performance+architecture, tests+regression, dependencies+API)
3. **Prioritizes findings** — 🔴 CRITICAL (blocks) / 🟡 IMPORTANT (fix or track) / 🟢 MINOR (informational)
4. **Decides** — APPROVE, CONDITIONAL APPROVE (🟡 items tracked as follow-up), or REJECT

→ See [`docs/SENTINEL.md`](./docs/SENTINEL.md) for the full verification checklist, review agent definitions, and workflow.

## Incremental Development — REQUIRED

- **1 PR = 1 logical unit** (one function, one component, one bugfix)
- Each increment must be independently testable and deployable
- Never mix unrelated changes in a single PR
- If a task is too large for one PR, break it down further

## Branching & Git Worktrees — REQUIRED

- **Never work directly on `main`** — `main` is always deployable
- **MUST use git worktrees** for isolation on every increment
- Branch naming: `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`
- Push branch → open PR → Sentinel review → merge → delete branch → remove worktree
- Worktree paths (e.g., `../gitnotate-feature-name`) are approved paths outside the repo root

## Sub-Agent Delegation

Delegate to specialized sub-agents when the task requires expertise you'd delegate to a colleague:
- Research (>5 sources needed), documentation (>100 words), test data creation, performance analysis, security review
- Each sub-agent works in its own context — provide full requirements
- Integrate sub-agent output back, ensuring it follows all rules in this file

> If your agent does not support sub-agents, perform these tasks inline or defer to the user.

## Commit Format

```
type(scope): short description

Longer description if needed.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`, `perf`

## Code Style

```typescript
// ✅ Good — typed, descriptive names, proper error handling, handles expected cases
export async function readLocalSidecar(
  filePath: string
): Promise<SidecarFile | null> {
  const sidecarPath = getSidecarPath(filePath);
  try {
    const content = await fs.readFile(sidecarPath, 'utf-8');
    return JSON.parse(content) as SidecarFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

// ❌ Bad — no types, vague names, no error handling, crashes on missing files
async function load(p) {
  const f = getSidecarPath(p);
  const data = await fs.readFile(f, 'utf8');
  return JSON.parse(data);
}
```

Key conventions:
- Prettier configured in project — always run before commit
- ESLint with typescript-eslint strict — fix all warnings
- Strict TypeScript (`strict: true`) — no `any` without justification

## Boundaries

### ✅ ALWAYS
- Before writing ANY code, verify a failing test exists for it
- Before running `git commit`, verify you are NOT on `main`
- Before opening a PR, run `pnpm test && pnpm lint`
- Before merging, invoke Sentinel and obtain approval
- Use git worktrees for every increment
- Include Sentinel report ID and reviewed commit SHA in PR description
- Write discovered knowledge to `LEARNINGS.md`, NOT to this file
- Record technical decisions in `DECISIONS.md`, NOT to this file
- Update `CHANGELOG.md` with every user-facing change

### ⚠️ ASK FIRST (requires explicit user approval — silence ≠ approval)
Present the decision to the user with justification and options. If no response, **pause and wait** — do not proceed.
- Adding or removing dependencies (including lockfile changes)
- Modifying CI/CD configuration
- Changing public API contracts
- Architectural changes that affect multiple packages
- Accessing or introducing environment variables that may hold secrets
- Invoking external network services beyond project-approved endpoints

### 🚨 HUMAN REQUIRED (agent cannot execute — user must perform or explicitly delegate with risk acknowledgment)
- Changes to authentication, cryptography, or PII-processing code
- Database schema migrations or data backfills on real data
- Changes to AGENTS.md, SENTINEL.md, or agent instruction files
- Production deployments or release tagging
- Any 🔴 CRITICAL security finding from Sentinel
- Sentinel rejects the same PR 3+ times on the same issue
- First-time setup of deployment pipelines or production access
- Handling of real user data, credentials rotation, or incident response

### 🚫 NEVER — Violations cause automatic Sentinel rejection

**Security violations** (immediate rejection):
- Commit secrets, credentials, or API keys — even in comments or test fixtures
- Send repository content or error traces to unapproved external services
- Access system files (SSH keys, OS config, other repositories) outside the project

**Process violations** (must redo the work):
- Write implementation code before writing tests — the #1 most common violation
- Combine test and implementation in a single commit
- Skip the Sentinel review process or merge without approval
- Work directly on `main`

**Integrity violations** (corrupts project state):
- Remove failing tests instead of fixing them
- Modify `node_modules/`, `dist/`, or generated files
- Force-push, rebase, or rewrite history on `main` or protected branches
- Modify Sentinel reports, audit logs, or review artifacts after creation
- **Write to AGENTS.md or SENTINEL.md** — these files are immutable; write knowledge to `LEARNINGS.md`, decisions to `DECISIONS.md`

## When Stuck — Recovery Rules

- **Tests won't pass after 3 attempts**: STOP. Analyze root cause. Revert to last green state if needed.
- **Sentinel rejects 3+ times on same issue**: STOP. Escalate to user — do not retry the same approach.
- **Lost context mid-workflow**: STOP. Re-read this file. Run `git status`. Review the plan. Resume from last completed increment.
- **Merge conflicts**: Rebase on latest `main`, resolve, re-run tests, re-submit to Sentinel.
- **Dependency install fails**: STOP. Report to user — do not attempt workarounds.

## Associated Documentation

Before touching tests, architecture, workflow, or merge/release steps, read the matching doc:

| Document | Contains | Read when... |
|----------|----------|-------------|
| [`docs/SENTINEL.md`](./docs/SENTINEL.md) | Sentinel checklist, review agents, invocation, infrastructure enforcement | Before any merge, deploy, or release |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Project structure, technical decisions | Making structural or cross-cutting changes |
| [`docs/TESTING-STRATEGY.md`](./docs/TESTING-STRATEGY.md) | Test types, coverage targets, framework details | Writing or modifying tests |
| [`docs/DEVELOPMENT-WORKFLOW.md`](./docs/DEVELOPMENT-WORKFLOW.md) | Git worktrees, branching details, PR process | Setting up workspace or parallel work |
| [`ROADMAP.md`](./ROADMAP.md) | Project phases, implementation plan | Understanding project direction |
| [`LEARNINGS.md`](./LEARNINGS.md) | Discovered knowledge, gotchas, patterns | **Write here** when you discover something new |
| [`DECISIONS.md`](./DECISIONS.md) | Architecture Decision Records (ADRs) | **Write here** when making technical decisions |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history | **Update** with every user-facing change |
