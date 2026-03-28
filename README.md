# Gitnotate

> **git + annotate** — Sub-line commenting for Markdown files in GitHub PR reviews.

Gitnotate lets you comment on specific words and phrases within a line — not just the whole line — directly in GitHub Pull Request reviews. It works as a Chrome/Edge browser extension that enhances GitHub's native commenting with sub-line precision.

## The Problem

GitHub PR reviews only support line-level comments. When reviewing Markdown documents (specs, proposals, plans), you often want to comment on a specific phrase like "revenue growth exceeded expectations" — not the entire line. Word and Google Docs do this well; GitHub doesn't.

## How It Works

Gitnotate uses a lightweight approach: it embeds sub-line metadata directly in standard GitHub PR comments. This means:

- **Works without the extension** — comments show a quoted text fallback, fully readable by anyone
- **Zero extra files** — no sidecar files or infrastructure needed
- **All GitHub features** — threading, resolve, @mentions, reactions, notifications work out of the box

See [ROADMAP.md](./ROADMAP.md) for the full architecture, research, and implementation plan.

## Status

🚧 **Early development** — Phase 1 (Browser Extension MVP) in progress.

## License

[MIT](./LICENSE)
