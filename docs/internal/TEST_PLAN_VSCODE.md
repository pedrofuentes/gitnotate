# Gitnotate VSCode Extension — Manual Test Plan

> **Scope**: Phase 1.5, Increment 1 (Auth + Git Service Foundation)
> **Updated**: 2026-03-30
> **Test repo**: https://github.com/pedrofuentes/gitnotate (or any repo with an open PR)

---

## Prerequisites

### Build & Load Extension

```bash
cd S:\Pedro\Projects\gitnotate
pnpm install
pnpm build
```

Load in VSCode:
1. Open the `gitnotate` folder in VSCode
2. Press **F5** to launch the Extension Development Host
3. In the new window, open a GitHub repo folder that has an open PR on the current branch

### Test Repo Setup

You need a local clone of a GitHub repo where:
- The current branch has an open PR (not `main` or `master`)
- The remote `origin` points to `github.com`

Example setup:
```bash
git clone https://github.com/pedrofuentes/test.git
cd test
git checkout feature/some-branch   # branch with an open PR
```

---

## Test Suite 1: Extension Activation

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1.1 | Extension activates on markdown | Open any `.md` file in the Extension Development Host | Output Channel shows `Gitnotate extension activated` | ⬜ |
| 1.2 | Commands registered | Open Command Palette (Ctrl+Shift+P), type "Gitnotate" | Shows 4 commands: Enable, Disable, Add Comment, Add File Comment | ⬜ |
| 1.3 | No PAT warning | Activate the extension | No warning about "GitHub token not configured" (old PAT flow removed) | ⬜ |

---

## Test Suite 2: GitHub OAuth Authentication

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 2.1 | OAuth shared session (GH PR ext installed) | Have the GitHub Pull Requests & Issues extension installed and signed in. Activate Gitnotate. | Gitnotate uses the existing GitHub session — no sign-in prompt. Status bar shows PR info if on a PR branch. | ⬜ |
| 2.2 | OAuth prompt (no existing session) | Sign out of GitHub in VSCode (Accounts menu → sign out). Run "Gitnotate: Add Comment" on selected text. | Shows error: "GitHub authentication required. Please sign in to GitHub." | ⬜ |
| 2.3 | Token retrieval silent on non-PR branch | Open a repo on `main` branch, activate extension | No auth prompt appears. Status bar hidden (no PR detected). Extension activates silently. | ⬜ |
| 2.4 | Auth failure logged | Open DevTools (Help → Toggle Developer Tools), check Console tab. Simulate auth failure by disabling network. | Console shows `[Gitnotate] getGitHubToken failed:` with error details | ⬜ |

---

## Test Suite 3: Git Service (VSCode Git API)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 3.1 | Branch detection | Open a repo on a feature branch. Check Output / status bar. | Extension detects the branch name via VSCode Git API (no shell `git` calls in process list) | ⬜ |
| 3.2 | Remote URL detection | Open a repo with `origin` pointing to GitHub. | Extension correctly parses owner/repo from the remote URL | ⬜ |
| 3.3 | Default branch skipped | Open a repo on `main` or `master`. | Status bar hidden — no PR detection attempted for default branches | ⬜ |
| 3.4 | No git repo | Open a folder that is NOT a git repo. | Extension activates but no PR detected, no errors. Status bar hidden. | ⬜ |
| 3.5 | SSH remote URL | Open a repo where `origin` uses SSH format (`git@github.com:owner/repo.git`). | Owner/repo parsed correctly — PR detection works | ⬜ |

---

## Test Suite 4: PR Detection & Status Bar

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | PR detected — status bar shows | Open a repo on a branch with an open PR. Be signed into GitHub. | Status bar shows `$(git-pull-request) Gitnotate: PR #N`. Tooltip shows `owner/repo#N`. | ⬜ |
| 4.2 | No PR — status bar hidden | Open a repo on a branch with no open PR. | Status bar item is hidden (not shown). | ⬜ |
| 4.3 | Authenticated request | Open DevTools Network tab, then activate extension on a PR branch while signed into GitHub. | GitHub API request to `/repos/.../pulls?...` includes `Authorization: Bearer ...` header | ⬜ |
| 4.4 | Unauthenticated fallback | Sign out of GitHub, then activate extension on a PR branch. | GitHub API request has no Authorization header. PR may still be detected (unauthenticated, 60 req/hr limit). | ⬜ |
| 4.5 | Rate limit handling | Exhaust GitHub API rate limit (or mock 403 response). | Console warns `[Gitnotate] GitHub API rate limit exceeded`. Status bar hidden. No crash. | ⬜ |

---

## Test Suite 5: Add Comment Command

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5.1 | No selection | Run "Gitnotate: Add Comment" with no text selected. | Shows info message: "Select text first" | ⬜ |
| 5.2 | Not authenticated | Sign out of GitHub. Select text. Run "Gitnotate: Add Comment". | Shows error: "GitHub authentication required. Please sign in to GitHub." | ⬜ |
| 5.3 | No PR on branch | Sign in to GitHub. Open repo on `main`. Select text. Run "Gitnotate: Add Comment". | Shows warning: "No pull request found for the current branch." | ⬜ |
| 5.4 | Full comment flow | Sign in to GitHub. Open repo on a PR branch. Select text in a file. Run "Gitnotate: Add Comment". Enter comment text. | Input box appears → type comment → "Comment posted successfully!" message. Comment appears on the PR on GitHub with `^gn` metadata. | ⬜ |
| 5.5 | Cancel input | Select text, run "Add Comment", press Escape on input box. | No comment posted. No error. | ⬜ |
| 5.6 | API failure | Select text, run "Add Comment" on a repo where you don't have write access. | Shows error: "Failed to post comment. Check your token and permissions." | ⬜ |

---

## Test Suite 6: Add File Comment Command (Local Sidecar)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6.1 | Create sidecar comment | Select text in a `.md` file. Run "Gitnotate: Add File Comment". Enter comment. | Success message. A `.comments/filename.md.json` file is created next to the file with the annotation. | ⬜ |
| 6.2 | Append to existing sidecar | Run "Add File Comment" again on the same file with different selected text. | The existing `.comments/filename.md.json` now has 2 annotations. | ⬜ |

---

## Test Suite 7: Enable/Disable Workspace

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7.1 | Enable workspace | Run "Gitnotate: Enable for Workspace" | Shows: "Gitnotate enabled for this workspace". Check settings: `gitnotate.enabledRepos` includes the workspace path. | ⬜ |
| 7.2 | Disable workspace | Run "Gitnotate: Disable for Workspace" | Shows: "Gitnotate disabled for this workspace". The workspace path is removed from `gitnotate.enabledRepos`. | ⬜ |

---

## Test Suite 8: Coexistence with GitHub PR & Issues Extension

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8.1 | Both extensions active | Install both Gitnotate and GitHub Pull Requests & Issues. Open a repo on a PR branch. | Both extensions activate without conflicts. Gitnotate shows its status bar. GH PR shows its sidebar. | ⬜ |
| 8.2 | Shared auth session | Sign in via GH PR extension. Check if Gitnotate can detect the PR. | Gitnotate uses the same OAuth session — no second sign-in needed. | ⬜ |
| 8.3 | No GH PR extension | Uninstall/disable GH PR extension. Activate Gitnotate. | Gitnotate works standalone — handles its own auth, git detection, and PR detection. | ⬜ |

---

## Known Limitations (Phase 1.5 Increment 1)

These are **not bugs** — they are documented limitations:

- **No decoration rendering**: `^gn` comments are not yet displayed as highlights in the editor. The `onDidChangeActiveTextEditor` handler is a TODO (Increment 2).
- **No Comments panel**: The `gitnotateComments` sidebar view is registered but has no data provider (Increment 4).
- **Single repo only**: `GitService` uses `repositories[0]` — multi-root workspaces default to the first repo.
- **Status bar doesn't auto-refresh**: PR detection runs once at activation. Switching branches doesn't update the status bar until VSCode is reloaded.
- **Line number drift**: If the local file has diverged from the PR diff, `^gn` line numbers in posted comments may not match the current file state.
