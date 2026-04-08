# Gitnotate — Sub-line commenting for GitHub PR reviews

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/pedrofuentes.gitnotate?label=VS%20Code%20Marketplace&color=10B981)](https://marketplace.visualstudio.com/items?itemName=pedrofuentes.gitnotate)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](https://github.com/pedrofuentes/gitnotate/blob/main/LICENSE)

GitHub PR reviews only support **line-level** comments. When reviewing Markdown
documents — specs, proposals, design docs — you often want to comment on a
specific phrase like *"revenue growth exceeded expectations"*, not the entire
line.

**Gitnotate** lets you comment on exact words and phrases within a line, directly
in your VS Code editor.

## Features

### 📝 Sub-line Comment Threads

Comment threads anchored to exact character ranges in PR diffs — not just whole
lines. Comments show as wavy underline highlights in the editor.

### 📂 Comments Sidebar

All PR comments grouped by file in a dedicated sidebar panel. Click any comment
to jump directly to the file and line.

### 💬 Reply & Resolve

Full threading support — reply to comments and resolve/unresolve threads, all
round-tripped to GitHub's review API.

### 🔄 Live Polling

Comments auto-refresh every 30 seconds (configurable). Uses ETag-based
conditional requests to minimize API usage. Pauses on window blur, resumes on
focus.

### ↔️ Side-aware Diffs

Comments are placed on the correct side in diff views — old file (LEFT) vs new
file (RIGHT). Side indicators (`[Old]`/`[New]`) shown in the sidebar.

### 📌 Diff-aware Anchoring

Comment threads follow text through local edits. If you edit lines above a
comment, the thread moves with the text.

## Getting Started

1. **Install** the extension from the
   [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=pedrofuentes.gitnotate)
2. **Open a repository** with an active GitHub Pull Request
3. **Sign in to GitHub** when prompted (uses VS Code's built-in GitHub auth)
4. **Open a Markdown file** from the PR — comment threads appear automatically
5. **Select text** and right-click → **"Gitnotate: Add Comment"** to post a
   sub-line comment

## How It Works

Gitnotate embeds lightweight `^gn` metadata in standard GitHub PR comments. This
means:

- **Works without the extension** — comments include a quoted text fallback,
  fully readable by anyone
- **Zero extra files** — no sidecar files or infrastructure needed
- **All GitHub features** — threading, resolve, @mentions, reactions, and
  notifications work out of the box

## Commands

| Command | Description |
|---------|-------------|
| `Gitnotate: Add Comment` | Add a sub-line comment on selected text |
| `Gitnotate: Enable for Workspace` | Enable Gitnotate for the current workspace |
| `Gitnotate: Disable for Workspace` | Disable Gitnotate for the current workspace |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitnotate.pollInterval` | `30` | Polling interval in seconds for live comment updates |
| `gitnotate.enabledRepos` | `[]` | List of repository paths where Gitnotate is enabled |

## Requirements

- VS Code 1.85 or later
- A GitHub repository with an open Pull Request
- GitHub authentication (VS Code's built-in GitHub auth provider)

## Links

- [GitHub Repository](https://github.com/pedrofuentes/gitnotate)
- [Changelog](https://github.com/pedrofuentes/gitnotate/blob/main/CHANGELOG.md)
- [Report an Issue](https://github.com/pedrofuentes/gitnotate/issues)
- [Browser Extension](https://github.com/pedrofuentes/gitnotate#installation)
  (Chrome/Edge)

## License

[MIT](https://github.com/pedrofuentes/gitnotate/blob/main/LICENSE)
