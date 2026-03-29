# Changelog — Gitnotate

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Sub-line text selection and `^gn` metadata injection on PR diff pages
- Proximity-based textarea targeting — metadata injected into the correct comment box by line number
- Multiple pending highlights tracked independently per textarea
- Submitted comment highlighting via `findCodeCell` (supports GitHub's new React diff UI)
- 3-field metadata format `^gn:LINE:START:END` with line number embedded
- Metadata visually hidden in submitted comments (preserved in edit source)
- Distinct highlight colors for multiple comments on the same line (6-color palette)
- Color association between highlights and comment threads (border + author name)
- `data-gn-*` attributes on highlight spans and `<td>` for future use
- 15 manual test cases documented in `docs/TESTING-STRATEGY.md`

### Changed
- Annotation IDs now use `crypto.randomUUID()` (UUID v4 format) instead of `Math.random()`-based 21-char base62 strings — existing annotations are unaffected (IDs are validated as non-empty strings)
- Metadata prefix changed from `@gn` to `^gn` (avoids GitHub @mention conflicts)
- Metadata format changed from 2-field `^gn:START:END` to 3-field `^gn:LINE:START:END`
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
- Legacy `<!-- @gn {...} -->` HTML comment format (superseded by `^gn:LINE:START:END`)
- `resolveLineNumber()` DOM walker in scanner (replaced by metadata-embedded line number)
