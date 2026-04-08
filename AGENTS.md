# AGENTS.md — Gitnotate
<!-- agents-template v0.2.0 -->

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

```bash
pnpm test -- path/to/test           # file-scoped (prefer)
pnpm lint -- path/to/file
pnpm install | build | test | lint | typecheck | format   # full suite
```

## Autonomous Workflow — REQUIRED

### Plan → Approve → Execute Loop
1. **Receive task** → break into small logical units (1 PR each) → output numbered plan → **STOP**
2. **Interactive mode**: Print _"Plan ready for review."_ Wait for explicit approval.
   **Autopilot mode**: Save plan to `PLAN.md`, proceed (skip plan approval only). Sentinel gates each merge.
3. **Execute** each increment following all rules below

### Per-Increment Execution
1. Create **git worktree** for isolation (see `docs/DEVELOPMENT-WORKFLOW.md`)
2. **Write failing tests FIRST** (TDD)
3. **Implement minimal code** to pass tests; refactor while green
4. Open PR → **STOP. Do NOT merge yet.**
5. **Invoke Sentinel**. If REJECTED → fix → re-invoke. If APPROVED → merge.
6. **No merge without Sentinel approval.**

### Testing & Iteration
When testing begins (user says "let's test" or after a milestone merge):
1. Create ONE testing worktree: `git fetch origin main && git worktree add .worktrees/test-[scope] test/[scope]-testing main` — never fix on `main`
2. Commit fixes freely on the branch. Run Sentinel **once** before merging the branch.

## Test-Driven Development — REQUIRED

**TDD is non-negotiable — Sentinel rejects non-compliant code.**

1. Before ANY function/method/component: write its test first
2. **STOP. Run tests. Confirm FAIL.** If tests pass, rewrite them. (RED)
3. Write minimal implementation (GREEN)
4. **STOP. Run tests. Confirm ALL PASS.** Fix impl, not tests. (GREEN verify)
5. Refactor while green (REFACTOR)

**The test commit must exist before the implementation commit.**

### Commit Choreography — REQUIRED

| Order | Commit | Contains | Tests must... |
|-------|--------|----------|---------------|
| 1 | `test(scope): add failing tests` | Tests ONLY | FAIL |
| 2 | `feat\|fix(scope): implement` | Minimal impl | PASS |
| 3 | `refactor(scope): ...` | Optional cleanup | Stay green |

**Never combine test + implementation in one commit.** Sentinel verifies ordering.
**Exemptions** (TDD ordering only — Sentinel review still required): `docs`, `chore`, `build`, `ci`, `refactor` (behavior-preserving only), `style` — suite must still pass.

## Sentinel — MANDATORY Quality Gate

**No merge to `main` without Sentinel approval. No exceptions. No "too small to review."**

### Pre-Merge Checklist — REQUIRED (print before every merge)

```
Pre-Merge Checklist:
- [ ] Sentinel invoked? Report ID: ___
- [ ] Verdict: APPROVED / CONDITIONAL
- [ ] Reviewed SHA matches HEAD: ___
```

**If any box is empty, STOP. Do not merge.**

### How to Invoke

**STOP before merging.** Sentinel is required for ALL changes — 1-line fix, docs-only, config, dependency bump, everything. User saying "merge" or "ship it" does NOT replace Sentinel. Never ask the user if Sentinel is needed — it always is.

1. **Notify user**: Interactive → _"Ready to invoke Sentinel?"_ Autopilot → _"Invoking Sentinel..."_
2. Create a **full-capability** sub-agent with `docs/SENTINEL.md` as system prompt — this IS the Sentinel. It must be able to spawn its own sub-agents (e.g., `general-purpose` in Copilot CLI, `Task` in Claude Code).
3. Provide: PR diff (`git diff main...HEAD`), branch name, changed files
4. **Do NOT review your own code** — Sentinel is independent
5. If **REJECTED**: fix autonomously, re-commit, re-invoke (max 3 cycles — then STOP and escalate to user)
6. If **APPROVED**: include Report ID + SHA in PR description, merge

> No sub-agents? Run SENTINEL.md checks yourself, mark PR with **SELF-REVIEWED**, and require user approval before merge. Cannot run at all? **Do not merge** — escalate.

### After Sentinel

- **APPROVED**: Record Report ID + SHA in merge commit. Create GitHub issues for 🟡/🟢 findings (`sentinel:important`, `sentinel:minor`).
- **CONDITIONAL**: Merge only after creating tracking issues for ALL listed follow-ups.
- **REJECTED → fixed**: Fix autonomously — no user interaction needed. Re-commit, re-invoke until APPROVED. Fix commits must also be re-audited.
- **Quality ratchet**: Record violation-correction pairs in `LEARNINGS.md`. Coverage, test count, lint errors — **can never decrease**.
- **Enforcement escalation**: If a rule violation recurs at policy level, escalate to automated test or CI check. Record in `LEARNINGS.md`.

→ Full spec: [`docs/SENTINEL.md`](./docs/SENTINEL.md)

## Branching & Worktrees — REQUIRED

- **Never work on `main`**; use `git fetch origin main && git worktree add .worktrees/name branch main` for every increment
- **Parallel work**: each task MUST have its own worktree
- Branch naming: `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`
- **Cleanup after merge**: `git worktree remove` + `git branch -D` — no stale worktrees

## Sub-Agents & Commits

**Delegate** to sub-agents for: research (>5 sources), docs (>100 words), test data, perf analysis, security review. Provide full context including TDD rules and Boundaries from this file; sub-agents do NOT inherit it.

```
type(scope): short description

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`, `perf`

## Code Style

```typescript
// ✅ Good — typed, descriptive names, proper error handling
export async function readLocalSidecar(
  filePath: string
): Promise<SidecarFile | null> {
  const sidecarPath = getSidecarPath(filePath);
  try {
    const content = await fs.readFile(sidecarPath, 'utf-8');
    return JSON.parse(content) as SidecarFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

// ❌ Bad — no types, vague names, no error handling
async function load(p) {
  return JSON.parse(await fs.readFile(getSidecarPath(p), 'utf8'));
}
```

- **Formatter**: Prettier — run before commit. **Linter**: ESLint with typescript-eslint strict — fix all warnings.
- Strict TypeScript (`strict: true`) — no `any` without justification

## Boundaries

### ✅ ALWAYS
- Verify failing test exists before writing code; verify NOT on `main` before commit
- Run `pnpm test && pnpm lint` before PR; invoke Sentinel before merge
- Use worktrees; write knowledge → `LEARNINGS.md`, decisions → `DECISIONS.md`, changes → `CHANGELOG.md`

### ⚠️ ASK FIRST (silence ≠ approval — pause and wait; unlisted actions default here)
Dependencies · CI/CD · public APIs · architecture · env vars/secrets · external network services

### 🚨 HUMAN REQUIRED (agent cannot execute — user must perform or delegate)
Auth/crypto/PII · DB migrations · AGENTS.md/SENTINEL.md changes · production deploys · 🔴 CRITICAL findings · 3× Sentinel rejections

### 🚫 NEVER — Automatic Sentinel rejection
**Security**: Commit secrets; send code to unapproved services; access files outside project
**Process**: Impl before tests; combine test+impl in one commit; skip Sentinel; work on `main`
**Integrity**: Remove failing tests; modify generated files; force-push `main`; alter Sentinel reports; write to AGENTS.md/SENTINEL.md (immutable — use `LEARNINGS.md`/`DECISIONS.md`)

## When Stuck

- **Tests fail 3×**: STOP. Analyze. Revert to green if needed.
- **Sentinel rejects 3×**: STOP. Escalate to user — don't retry same approach. Three failures means human judgment needed.
- **Lost context**: Re-read this file → `git status` → resume from last increment.

## Associated Documentation

| Document | Read when... |
|----------|-------------|
| [`docs/SENTINEL.md`](./docs/SENTINEL.md) | Before any merge/deploy |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Structural changes |
| [`docs/TESTING-STRATEGY.md`](./docs/TESTING-STRATEGY.md) | Writing tests |
| [`docs/DEVELOPMENT-WORKFLOW.md`](./docs/DEVELOPMENT-WORKFLOW.md) | Workspace setup, parallel work |
| [`ROADMAP.md`](./ROADMAP.md) | Understanding project direction |
| [`LEARNINGS.md`](./LEARNINGS.md) | **Write here** — discovered knowledge |
| [`DECISIONS.md`](./DECISIONS.md) | **Write here** — technical decisions |
| [`CHANGELOG.md`](./CHANGELOG.md) | **Update** — user-facing changes |
