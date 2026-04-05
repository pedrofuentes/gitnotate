# Learnings — Gitnotate

> **This file is written by AI agents.** When you discover something about this project
> that isn't documented elsewhere, add it here. Do NOT write to AGENTS.md.
>
> Periodically, a human or agent should review this file and promote stable learnings
> into the appropriate companion doc (ARCHITECTURE.md, TESTING-STRATEGY.md, etc.).

## Format

```markdown
### [YYYY-MM-DD] Short description
**Context**: What were you doing when you discovered this?
**Learning**: What did you learn?
**Impact**: How should this affect future work?
```

## Learnings

<!-- Add new learnings below this line, most recent first -->

### [2026-04-05] Three test gap patterns that let runtime bugs ship

**Context**: Increment 5 shipped 341 unit tests and 22 integration tests, all passing. Manual testing found 3 major runtime bugs within minutes: (1) race condition crashing on `threadSync` being undefined, (2) `TreeView.reveal()` crashing on missing `getParent()`, (3) side filtering hiding comments in diff views. None were caught by automated tests.

**Learning**: The test suite has three systemic gaps that must be addressed in all future test plans:

1. **Async race conditions with shared mutable state** — Module-scope variables (`threadSync`, `prService`, `cachedToken`) are mutated by multiple event handlers (`onDidChangeActiveTextEditor`, `onDidChangeState`, `onDidChangeSessions`, `onDidChangeWindowState`). Tests only fire handlers sequentially with pre-resolved mocks. **Fix**: Write race tests using deferred promises — start handler A, let it `await`, fire handler B that resets state, then resolve A's await and verify no crash. Always capture module-scope references into local variables before `await` chains.

2. **VSCode API contract compliance in mocks** — `TreeView.reveal()` mock was `vi.fn()` — it validates "method was called" but not "VSCode can actually do this." Real VSCode requires `getParent()` on the TreeDataProvider for `reveal()` to work. **Fix**: Mocks for VSCode APIs with prerequisites must enforce the same contracts. At minimum, `createTreeView` mock should verify the provider has `getParent()` when `reveal()` is called.

3. **UI lifecycle scenarios — testing event absence** — Side filtering logic was correct in isolation, but relied on `onDidChangeActiveTextEditor` firing when switching diff panes. VSCode's diff editor doesn't fire this event for pane switches. **Fix**: Integration tests should model real UI flows, not just handler invocations. Test "what happens when the expected event DOESN'T fire" — this is where features break in practice.

**Impact**: Every future test plan must include at minimum:
- One race test per async handler that touches shared mutable state
- Contract-validating mocks for VSCode APIs (not just `vi.fn()`)
- A "negative scenario" test for each UI event dependency (what if the event never fires?)

### [2026-04-01] Never merge without Sentinel — no size exception
**Context**: `fix/auth-change-clear-threads` (1-line production fix + 1 test) was merged to `main` without invoking Sentinel. Retroactive review (SENTINEL-2026-0331-R001) found the code correct but flagged the process violation.
**Learning**: No fix is too small for Sentinel. The mental shortcut "it's just 1 line" bypasses the quality gate. Sentinel must be invoked before every `git merge` to `main`, regardless of change size. If you catch yourself thinking "this is too small to review," that is the exact moment you must invoke Sentinel.
**Impact**: Consider adding a pre-merge checklist that must be printed before every merge, and escalating to a CI check (L5) that verifies merge commits contain a Sentinel Report ID.

### [2026-04-01] Do not rewrite tests in the fix commit
**Context**: Retroactive Sentinel review (SENTINEL-2026-0331-R001) flagged `68ce696` for modifying `extension.test.ts` alongside `extension.ts`. The test commit (`8e493d8`) wrote a test using `__getCommentThreads()` + `dispose()` assertion, but the fix commit rewrote it to use `vi.spyOn(CommentController.prototype, 'clearThreads')` — effectively rewriting the test during implementation.
**Learning**: The `feat`/`fix` commit must contain ONLY production code. If the test approach needs to change during implementation, separate the test adjustment into its own `test` or `refactor` commit. The test commit must remain intact as proof that the test detected the bug before the fix.
**Impact**: Preserves the RED→GREEN evidence chain. Future agents should finalize the test approach before committing the test commit, not adjust it during the fix commit.

### [2026-03-31] Hoist long-lived service instances above debounced callbacks
**Context**: Sentinel review (SENTINEL-2025-0715-CTS-001) of `feature/comment-controller-thread-sync` found that `PrService` and `CommentThreadSync` were instantiated inside the debounced `onDidChangeActiveTextEditor` callback, making `CommentThreadSync`'s in-memory cache useless — a new instance (with an empty cache) is created on every editor change.
**Learning**: When a class provides caching or state persistence, hoist its instantiation to the activation scope so the cache survives across invocations. Instantiate per-callback only when statelessness is intentional.
**Impact**: Follow-up PR needed to hoist `PrService` and `CommentThreadSync` to `activate()` scope with invalidation on token/PR changes. Also add a `MAX_PAGES` safety bound to the pagination loop in `PrService.listReviewComments`.

### [2026-03-29] Use `refactor` commit type when production behavior is unchanged
**Context**: Sentinel review of `fix/test-reliability` (SENTINEL-002-20250712) flagged commit `96479b5 fix(github-action): export run promise for deterministic test awaiting` because the `fix` label implies a behavioral change requiring TDD choreography, but the production behavior was unchanged — only export visibility was modified for test infrastructure.
**Learning**: Use `refactor(scope)` instead of `fix(scope)` when a change does not alter production behavior, even if the motivation is to fix tests. The `refactor` type is TDD-exempt, avoiding unnecessary choreography overhead. Reserve `fix` for commits that change observable behavior.
**Impact**: Prevents Sentinel flagging false TDD violations. Reduces unnecessary test→fix commit pairs for non-behavioral changes.

### [2026-03-29] Post-merge Sentinel audit found 9 CRITICAL findings across entire codebase

**Context**: All 96 commits were merged to main without Sentinel review. A retroactive Sentinel audit (SENTINEL-2025-0714-RETRO-001) reviewed the full diff (8f38b03..HEAD, 127 files, ~18K lines).

**Learning**: The audit identified 9 🔴 CRITICAL, 32 🟡 IMPORTANT, and 17 🟢 MINOR findings. Key categories:
- **Data loss bugs**: `btoa()` crashes on Unicode (emoji, CJK, accents) — replaced with `TextEncoder`/`TextDecoder`-based helpers
- **Crash-on-malformed-input**: `JSON.parse(atob(data.content))` without try/catch or schema validation — added resilience and `validateSidecarFile()` call
- **Memory leaks (3)**: MutationObserver and event listeners accumulating across Turbo navigations — tracked via `ObserverLifecycle` and `AbortSignal`
- **Dependency CVEs**: `undici@5.29.0` (via `@actions/github@6.0.1`) had 5 CVEs — upgraded to `@actions/github@9.0.0`
- **Coverage gap**: `github-action/src/index.ts` at 0% coverage — added 8 tests, coverage now 98.2%
- **Lint violations**: 3 non-null assertions — replaced with optional chaining / nullish coalescing

**Impact**: Always run Sentinel before merging. Retroactive audits are expensive (10+ minutes, multiple sub-agents) and produce more findings that accumulate. The `btoa`/`atob` issue should be caught by a lint rule or utility function mandate — consider adding a `no-restricted-globals` ESLint rule for `btoa`/`atob` to prevent future occurrences.



**Context**: During the `fix/textarea-proximity-targeting` merge, the Sentinel post-audit found that only 2 of 27 feat/fix commits followed proper TDD choreography (separate test commit before implementation commit). Of the 25 violations: 11 bundled test and implementation code in a single commit, 13 had no corresponding tests at all, and 1 had tests committed after implementation (reversed order).

**Learning**: TDD choreography requires three distinct, ordered commits per behavioral change: (1) a `test(scope)` commit containing only tests that fail, (2) a `feat|fix(scope)` commit with minimal implementation to pass those tests, and (3) an optional `refactor(scope)` commit. Bundling tests with implementation defeats the purpose — it provides no proof the tests ever failed, so they may be testing nothing meaningful. Skipping tests entirely is worse. The Sentinel rejected the merge in post-audit, requiring remediation before the work could land.

**Impact**: Every feat/fix commit must be preceded by a separate test-only commit. Run tests after the test commit to confirm they fail (RED), then implement and confirm they pass (GREEN). Consider adding a `commit-msg` hook or CI check that verifies feat/fix commits are preceded by a corresponding test commit on the same branch, to catch violations before they reach the Sentinel.

### [2026-03-29] GitHub's `@` prefix triggers user mention lookups
**Context**: Users reported that `@gn:...` metadata tags were being interpreted as GitHub @mentions, linking to github.com/GN.
**Learning**: The `@` character is reserved by GitHub for user/team mentions. Any metadata prefix starting with `@` followed by alphanumeric characters will trigger mention resolution. The caret (`^`) is safe — GitHub doesn't use it for any feature.
**Impact**: Always use `^gn:` prefix for metadata tags. If choosing new prefixes in the future, avoid `@`, `#`, `!`, `` ` ``, `~` (double), and `>` which are all used by GitHub Flavored Markdown.

### [2026-03-29] GitHub renders backtick-wrapped text as `<code>` elements, stripping backticks from textContent
**Context**: The parser required backtick delimiters (`` `@gn:...` ``), which worked in textarea values but failed when scanning submitted comments because GitHub renders backticks as `<code>` elements.
**Learning**: When GitHub renders a comment, `` `text` `` becomes `<code>text</code>`. The `textContent` of the `<code>` element is `text` (no backticks). Any parsing logic that depends on backticks in `textContent` will fail for submitted comments. Plain text metadata (no backticks) avoids this entirely.
**Impact**: Never rely on backticks being present in DOM `textContent`. Use plain-text metadata formats.

### [2026-03-29] GitHub's new React diff UI uses sibling `<td>` cells, not parent-child
**Context**: `findCodeCell()` used `td[data-line-number="N"] .diff-text-inner` which assumes `.diff-text-inner` is a child of the `data-line-number` cell. This selector returned null in the new UI.
**Learning**: In GitHub's current React-based diff UI, each `<tr>` has separate `<td>` cells for line numbers and code content. The line number cell (`data-line-number`) and the code cell (`.diff-text-inner`) are siblings, not parent-child. The fallback strategy is: find `[data-line-number="N"]` → get parent `<tr>` → search sibling cells for `.diff-text-inner`.
**Impact**: Always include a sibling-cell fallback when searching for code cells by line number. Don't assume GitHub's DOM structure is stable — it changes with React UI updates.

### [2026-03-29] GitHub renders `@gn` tags in non-diff contexts (review summary panels)
**Context**: The scanner found `^gn:97:192` with `file= line=0` — the tag existed in a review summary panel outside the diff table where `resolveFilePath` and `resolveLineNumber` couldn't find context.
**Learning**: GitHub sometimes duplicates comment content in non-diff contexts (summary panels, notification areas). The scanner's deduplication picked up the broken occurrence first and skipped the valid one. Fix: skip entries with no valid context (empty file/zero line) without adding them to the dedup set, so the valid occurrence in the actual diff thread is processed.
**Impact**: When scanning for metadata, always validate the DOM context before accepting a match. Don't add context-less matches to deduplication sets.

### [2026-03-29] GitHub's split-view diffs have TWO `data-line-number` cells per row
**Context**: `getTextareaLineNumber` only checked the first `data-line-number` cell (old/left side), but `selInfo.lineNumber` used the right/new side. This caused an off-by-one mismatch.
**Learning**: In split-view diffs, each `<tr>` has line number cells for both old and new file sides. Matching by a single line number will miss the other side. Collect ALL `data-line-number` values from a row and match against any of them.
**Impact**: When resolving line numbers from diff rows, always check all `data-line-number` cells, not just the first one.

### [2026-03-29] GitHub inserts intermediate rows between code and comment form
**Context**: `getTextareaLineNumbers` walked back from the textarea's `<tr>` to find the nearest code row, but intermediate rows (with `empty-diff-line` cells) caused it to read a line number one off from the actual code line.
**Learning**: GitHub's diff DOM inserts empty/spacer rows between the code row and the inline comment form row. Line number lookup by walking `previousElementSibling` may land on the wrong row. A ±1 tolerance on line number matching handles this reliably.
**Impact**: When matching textarea line numbers to selection line numbers, use exact match first, then ±1 tolerance as fallback.

### [2026-03-29] `turbo:load` causes double event handler registration
**Context**: `init()` was called twice (once from the initial load, once from `turbo:load`), registering duplicate `mouseup` handlers that caused double metadata injection.
**Learning**: GitHub's Turbo navigation fires `turbo:load` on page transitions, which re-runs `init()`. A boolean `activated` flag doesn't prevent this because `init()` resets it. Using an `AbortController` to cancel previous event listeners before registering new ones is more reliable.
**Impact**: Use `AbortController` with `{ signal }` on event listeners that should not accumulate across navigation events.
