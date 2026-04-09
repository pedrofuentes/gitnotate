# Gitnotate

> **git + annotate** — Sub-line commenting for Markdown files in GitHub PR reviews.

[![CI](https://github.com/pedrofuentes/gitnotate/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofuentes/gitnotate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-10B981.svg)](./CHANGELOG.md)

Gitnotate lets you comment on specific words and phrases within a line — not just the whole line — directly in GitHub Pull Request reviews. It ships as a **Chrome/Edge browser extension** and a **VSCode extension**, both enhancing GitHub's native commenting with sub-line precision.

## The Problem

GitHub PR reviews only support line-level comments. When reviewing Markdown documents (specs, proposals, plans), you often want to comment on a specific phrase like "revenue growth exceeded expectations" — not the entire line. Word and Google Docs do this well; GitHub doesn't.

## How It Works

Gitnotate uses a lightweight approach: it embeds sub-line metadata directly in standard GitHub PR comments. This means:

- **Works without the extension** — comments show a quoted text fallback, fully readable by anyone
- **Zero extra files** — no sidecar files or infrastructure needed
- **All GitHub features** — threading, resolve, @mentions, reactions, notifications work out of the box

See [ROADMAP.md](./ROADMAP.md) for the full architecture, research, and implementation plan.

## Installation

### VS Code Marketplace
1. Search "Gitnotate" in the Extensions view (`Ctrl+Shift+X`) or visit the [VS Code Marketplace page](https://marketplace.visualstudio.com/items?itemName=pedrofuentes.gitnotate)
2. Click **Install**
3. Open a repo with an active PR — sign in to GitHub when prompted
4. Select text in a Markdown file and right-click → **Gitnotate: Add Comment**

### Chrome Web Store
1. Visit the [Gitnotate page on Chrome Web Store](https://chrome.google.com/webstore/detail/agfdgeojcagbmadfffiiccgfhgmakngp)
2. Click **Add to Chrome**

### Edge Add-ons
1. Visit the [Gitnotate page on Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/gitnotate/nkbdpjplkeeoncbdelkfneinclinnemp)
2. Click **Get** to install

### Install from GitHub Release
1. Download `gitnotate-v0.1.0.zip` from the [latest release](https://github.com/pedrofuentes/gitnotate/releases/latest)
2. Extract the zip to a folder on your computer
3. Open `chrome://extensions` (or `edge://extensions`)
4. Enable **"Developer mode"** (toggle in the top-right corner)
5. Click **"Load unpacked"** → select the extracted folder
6. The Gitnotate icon should appear in your toolbar

> **Note:** Manually installed extensions show a "Developer mode" warning on browser startup. Installing from the store removes this.

To update: download the new zip, extract to the same folder, then click the reload ↻ button on the extension card.

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

## VSCode Extension

The VSCode extension brings sub-line commenting directly into your editor for GitHub PR reviews.

### Key Capabilities
- **Sub-line comment threads** — native VSCode comment threads anchored to exact character ranges in PR diffs
- **Comments sidebar** — all PR comments grouped by file with click-to-navigate
- **Reply & resolve** — full threading and resolution via GitHub's review API
- **Live polling** — auto-refresh comments via ETag-based conditional requests (configurable interval)
- **Side-aware diffs** — comments placed on the correct side (old/new) in diff views
- **Diff-aware anchoring** — comment threads follow text through local edits

### Install
Search "Gitnotate" in VSCode's Extensions view or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=pedrofuentes.gitnotate).

### Setup
1. Open a repository with an active PR
2. Sign in to GitHub when prompted (uses VSCode's built-in GitHub auth)
3. Open a Markdown file from the PR — comment threads appear automatically
4. Select text and right-click → "Gitnotate: Add Comment" to post a sub-line comment

## Status

🚀 **v0.1.0** — Browser extension for Chrome/Edge and VSCode extension — all live.

## License

[MIT](./LICENSE)
