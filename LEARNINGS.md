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
