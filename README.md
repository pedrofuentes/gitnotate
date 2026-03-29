# Gitnotate

> **git + annotate** — Sub-line commenting for Markdown files in GitHub PR reviews.

[![CI](https://github.com/pedrofuentes/gitnotate/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofuentes/gitnotate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-10B981.svg)](./CHANGELOG.md)

Gitnotate lets you comment on specific words and phrases within a line — not just the whole line — directly in GitHub Pull Request reviews. It works as a Chrome/Edge browser extension that enhances GitHub's native commenting with sub-line precision.

## The Problem

GitHub PR reviews only support line-level comments. When reviewing Markdown documents (specs, proposals, plans), you often want to comment on a specific phrase like "revenue growth exceeded expectations" — not the entire line. Word and Google Docs do this well; GitHub doesn't.

## How It Works

Gitnotate uses a lightweight approach: it embeds sub-line metadata directly in standard GitHub PR comments. This means:

- **Works without the extension** — comments show a quoted text fallback, fully readable by anyone
- **Zero extra files** — no sidecar files or infrastructure needed
- **All GitHub features** — threading, resolve, @mentions, reactions, notifications work out of the box

See [ROADMAP.md](./ROADMAP.md) for the full architecture, research, and implementation plan.

## Installation

### Chrome Web Store
Coming soon — [install from source](#install-from-source) in the meantime.

### Edge Add-ons
Coming soon — same extension works on both browsers (Manifest V3).

### Install from Source
1. Clone the repo: `git clone https://github.com/pedrofuentes/gitnotate.git`
2. Install dependencies: `pnpm install`
3. Build: `pnpm build`
4. Open `chrome://extensions` (or `edge://extensions`)
5. Enable "Developer mode"
6. Click "Load unpacked" → select `packages/browser-extension/dist/`

### Setup
1. Click the Gitnotate icon in your toolbar
2. Visit any PR → click "Enable" on the opt-in banner
3. Select text in a diff to start commenting

## Status

🚀 **v0.1.0** — First public release. Browser extension for Chrome/Edge.

## License

[MIT](./LICENSE)
