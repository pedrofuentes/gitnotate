# Gitnotate — Sub-Line Commenting for GitHub PR Reviews

**Comment on specific words and phrases in GitHub Pull Request diffs — not just whole lines.**

GitHub's built-in review tools only let you comment on entire lines. But when you're reviewing Markdown changes — documentation, READMEs, changelogs, blog posts — you often want to point out a specific word choice, a typo in one phrase, or a formatting issue in part of a line. Gitnotate gives you that precision.

---

## ✨ What Gitnotate Does

Gitnotate is a browser extension that adds **sub-line commenting** to GitHub Pull Request reviews. Select any word, phrase, or sentence within a PR diff, and Gitnotate helps you attach a review comment to that exact selection — not the whole line.

Your comment is posted as a standard GitHub PR comment with a small metadata tag (`^gn`) that records the selection. Other Gitnotate users see highlighted text and color-matched comment threads. Users without the extension still see a clean, readable quoted fallback — no broken workflows, no confusion.

---

## 🎯 Why It Matters

- **Line-level comments aren't precise enough.** When a line contains multiple changes or a long paragraph, pointing at "the third word" requires extra explanation.
- **Sub-line comments are self-explanatory.** The highlighted selection shows exactly what you mean — no ambiguity.
- **Markdown reviews benefit the most.** Documentation, prose, and content files often have long lines where word-level precision makes a real difference.

---

## 🔑 Key Features

### Precise Text Selection in Diffs
Select any word, phrase, or sentence within a GitHub PR diff. Gitnotate captures the exact text range — file path, line number, character offsets — and embeds it into your review comment.

### Visual Highlights
Submitted comments with Gitnotate metadata are rendered with colored highlights directly in the diff view. Multiple comments on the same line get distinct colors from a 6-color palette, so you can tell them apart at a glance.

### Color-Matched Comment Threads
Comment threads in the PR sidebar are color-coded to match their corresponding highlights in the diff, making it easy to connect feedback to the exact text it references.

### Highlight Style Options
Choose the highlight style that works best for you:
- **Dashed underline** (default)
- **Solid underline**
- **Background highlight**

### Graceful Degradation
Comments work for everyone — with or without the extension installed:
- **With Gitnotate:** Highlighted text, color-matched threads, full visual experience.
- **Without Gitnotate:** Comments display normally with a readable quoted snippet. The `^gn` metadata is small and unobtrusive. All standard GitHub features — threading, resolving, @mentions, reactions, notifications — work exactly as expected.

### Per-Repository Control
Enable Gitnotate only on the repositories where you want it. The extension shows an opt-in banner when you visit a new repo's PR, and you can manage your preferences from the popup at any time.

### Privacy-First Design
- **All data stays in your browser.** Your GitHub token, repository preferences, and settings are stored locally in Chrome/Edge storage.
- **No analytics, no tracking, no telemetry.** Zero data collection.
- **No third-party servers.** The extension only communicates with `github.com` and `api.github.com` — nothing else.
- **Open source.** The full source code is available for inspection.

---

## 🔧 How It Works

1. **Open a Pull Request** on GitHub and navigate to the Files Changed tab.
2. **Select text** — highlight any word, phrase, or sentence within a diff line.
3. **Comment** — Gitnotate injects a small `^gn` metadata tag into the comment that records your selection (file, line, offsets, quoted text).
4. **Submit** — your comment is posted as a normal GitHub PR comment. Gitnotate users see highlights; everyone else sees a clean quoted fallback.

The `^gn` metadata format is compact and human-readable:

```
^gn:42:10:25
```

This means: line 42, character offsets 10 to 25 — the exact sub-line range you selected.

---

## 🚀 Getting Started

### Installation
1. Install Gitnotate from the Chrome Web Store (or Edge Add-ons — same extension, Manifest V3 compatible).
2. Click the Gitnotate icon in your browser toolbar.

### Setup
1. **Enable per repository:**
   - Visit a Pull Request on any repository.
   - Gitnotate shows an opt-in banner — click "Enable" to activate it for that repo.
   - Or manage repositories from the popup menu.

### Usage
- Navigate to any PR's "Files changed" tab on an enabled repository.
- Select text in the diff → Gitnotate captures the selection.
- Write your comment and submit — done.

---

## 🔒 Privacy

Gitnotate is designed with privacy as a core principle:

- **Local storage only** — your preferences never leave your browser.
- **No network requests** — does not communicate with any server.
- **No data collection** — zero analytics, tracking, or telemetry.
- **Minimal permissions** — only `activeTab`, `storage`, and access to `github.com`.

Full privacy policy: https://pedrofuentes.github.io/gitnotate/privacy-policy.html

---

## 📖 Open Source

Gitnotate is free and open source under the MIT License.

Source code: https://github.com/pedrofuentes/gitnotate

Contributions, bug reports, and feature requests are welcome.

---

## 📋 Requirements

- **Browser:** Chrome or Edge (Manifest V3)
- **GitHub:** A GitHub account
- **Works on:** Any GitHub repository with Pull Requests

---

**Gitnotate** — because code review should be precise. 🎯
