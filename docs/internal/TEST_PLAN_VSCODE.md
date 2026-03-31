# Gitnotate VSCode Extension — Manual Test Plan

> **Scope**: Phase 1.5, Increment 1 (Auth + Git Service Foundation)
> **Updated**: 2026-03-31
> **Test repo**: https://github.com/pedrofuentes/gitnotate (or any repo with an open PR)

---

## Prerequisites

### Build & Load Extension

```bash
cd S:\Pedro\Projects\gitnotate
pnpm install
pnpm build
```

#### Launch the Extension Development Host

1. Open the **gitnotate monorepo root** folder in VSCode (`S:\Pedro\Projects\gitnotate`)
2. Go to **Run and Debug** panel (Ctrl+Shift+D)
3. Select a launch config from the dropdown at the top:
   - **"Launch Gitnotate Extension"** — disables other extensions (faster, no noise from unrelated extensions)
   - **"Launch Gitnotate (with other extensions)"** — keeps all extensions enabled (use for Test Suite 8: GH PR coexistence)
4. Press **F5** (or click the green play button)
5. VSCode builds core + extension automatically (pre-launch task), then opens a new **Extension Development Host** window with Gitnotate loaded

> **Troubleshooting**:
> - **"Select a debugger" prompt**: Make sure you have the monorepo root open (not a subfolder). The `.vscode/launch.json` at the root configures the `extensionHost` debugger.
> - **"Extension host did not start in 10 seconds"**: The launch config has a 30s timeout. If it still times out, run `pnpm build` manually in the terminal first, then try F5 again.
> - **Errors from other extensions** (e.g., Edge DevTools): Use the default "Launch Gitnotate Extension" config which disables other extensions via `--disable-extensions`.

#### In the Extension Development Host window

6. Open a **local clone of a GitHub repo** that has an open PR on the current branch
   - Use **File → Open Folder** and select the cloned repo
   - The repo must be on a feature branch (not `main`/`master`) with an open PR — Gitnotate skips default branches since PRs are opened *from* feature branches

> **Note**: The Extension Development Host is a separate VSCode window. Your original window stays open for debugging — you can set breakpoints, view the Debug Console, and inspect variables there.

#### Watch mode (optional, for iterating)

If you're making changes to the extension and want automatic rebuilds:

```bash
# In a terminal, start the esbuild watcher
cd packages/vscode-extension
pnpm watch
```

Then press **Ctrl+Shift+F5** in the Extension Development Host to reload the extension after each rebuild.

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

## Viewing Debug Output

Debug logs are **only emitted in the Extension Development Host** (when launched via F5). They are suppressed in production.

To view debug output:
1. In the **Extension Development Host** window, open DevTools: **Help → Toggle Developer Tools**
2. Go to the **Console** tab
3. Filter by `[Gitnotate]` to see only Gitnotate logs

All debug messages are prefixed with `[Gitnotate]`.

---

## Test Suite 1: Extension Activation

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1.1 | Extension activates on markdown | Open any `.md` file in the Extension Development Host | Debug Console: `[Gitnotate] Debug logging enabled (Extension Development Host)` then `[Gitnotate] Extension activating...` | ✅ |
| 1.2 | Commands registered | Open Command Palette (Ctrl+Shift+P), type "Gitnotate" | Shows 4 commands: Enable, Disable, Add Comment, Add File Comment. Debug Console: `[Gitnotate] Commands registered: enable, disable, addComment, addFileComment` | ✅ |
| 1.3 | No PAT warning | Activate the extension | No warning about "GitHub token not configured" (old PAT flow removed) | ✅ |

---

## Test Suite 2: GitHub OAuth Authentication

> **Tip**: Use Command Palette → **`GitHub: Sign In`** to sign in. To sign out, click the **Accounts icon** (bottom-left of sidebar) → your GitHub account → **Sign Out**.

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 2.1 | OAuth shared session (GH PR ext installed) | Have the GitHub Pull Requests & Issues extension installed and signed in. Activate Gitnotate. Use **"Launch Gitnotate (with other extensions)"** config. | Debug Console: `[Gitnotate] Auth: requesting GitHub session (silent)...` then `[Gitnotate] Auth: session found, account: <your-username>`. Status bar shows PR info if on a PR branch. | ✅ |
| 2.2 | OAuth prompt (no existing session) | Accounts icon (bottom-left) → Sign Out of GitHub. Run "Gitnotate: Add Comment" on selected text. | Shows error: "GitHub authentication required. Please sign in to GitHub." | ✅ |
| 2.3 | Token retrieval silent on non-PR branch | Open a repo on `main` branch, activate extension | Debug Console: `[Gitnotate] Auth: no existing session` (if signed out) or `Auth: session found` (if signed in), then `[Gitnotate] GitService.isDefaultBranch: main — skipping PR detection`. Status bar hidden. | ✅ |
| 2.4 | Auth failure logged | Hard to reproduce manually — requires network failure during auth only. | Console shows `[Gitnotate] getGitHubToken failed:` with error details | ⏭️ Covered by unit test (auth.test.ts) |
| 2.5 | Sign-in prompt on PR without auth | Open a repo on a PR branch while signed out. | Info message: "Sign in to GitHub to enable sub-line commenting on this PR." with "Sign In" button. Click → OAuth flow → `[Gitnotate] Auth: authenticated as <username>` → status bar refreshes with `(authenticated)`. | ✅ |

---

## Test Suite 3: Git Service (VSCode Git API)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 3.1 | Branch detection | Open a repo on a feature branch. Check DevTools Console. | Debug Console: `[Gitnotate] GitService: vscode.git API loaded, 1 repo(s)` then `[Gitnotate] GitService.getCurrentBranch: feature/your-branch` | ✅ |
| 3.2 | Remote URL detection | Open a repo with `origin` pointing to GitHub. Check DevTools Console. | Debug Console: `[Gitnotate] GitService.getRemoteUrl: origin → https://github.com/owner/repo.git` then `[Gitnotate] GitService.parseGitHubOwnerRepo: ... → owner/repo` | ✅ |
| 3.3 | Default branch skipped | Open a repo on `main` or `master`. Check DevTools Console. | Debug Console: `[Gitnotate] GitService.isDefaultBranch: main — skipping PR detection` then `[Gitnotate] No PR detected — status bar hidden` | ✅ |
| 3.4 | No git repo | Open a folder that is NOT a git repo. Check DevTools Console. | Debug Console: `[Gitnotate] GitService: vscode.git extension not available` or `[Gitnotate] PR detection: git not available`. No errors. | ⬜ |
| 3.5 | SSH remote URL | Open a repo where `origin` uses SSH format (`git@github.com:owner/repo.git`). | Debug Console: `[Gitnotate] GitService.getRemoteUrl: origin → git@github.com:owner/repo.git` then `GitService.parseGitHubOwnerRepo: ... → owner/repo` | ⬜ |

---

## Test Suite 4: PR Detection & Status Bar

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | PR detected — status bar shows | Open a repo on a branch with an open PR. Be signed into GitHub. | Debug Console: `[Gitnotate] PR detection: fetching https://api.github.com/... (authenticated)` then `[Gitnotate] PR detection: found PR #N (owner/repo)` then `[Gitnotate] PR detected: owner/repo#N`. Status bar shows `Gitnotate: PR #N`. | ✅ |
| 4.2 | No PR — status bar hidden | Open a repo on a branch with no open PR. | Debug Console: `[Gitnotate] PR detection: no open PRs for branch feature/...` then `[Gitnotate] No PR detected — status bar hidden` | ⬜ |
| 4.3 | Authenticated request | Check DevTools Console on a PR branch while signed in. | Debug Console: `[Gitnotate] Auth token: present` and `PR detection: fetching ... (authenticated)` | ✅ |
| 4.4 | Unauthenticated fallback | Sign out of GitHub, then activate on a PR branch. | Debug Console: `[Gitnotate] Auth token: absent` and `PR detection: fetching ... (unauthenticated)` | ✅ |
| 4.5 | Rate limit handling | Exhaust GitHub API rate limit (or mock 403 response). | Console warns `[Gitnotate] GitHub API rate limit exceeded`. Status bar hidden. No crash. | ⬜ |

---

## Test Suite 5: Add Comment Command

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5.1 | No selection | Run "Gitnotate: Add Comment" with no text selected. | Shows info message: "Select text first" | ✅ |
| 5.2 | Not authenticated | Accounts icon → Sign Out. Select text. Run "Gitnotate: Add Comment". | Shows error: "GitHub authentication required. Please sign in to GitHub." | ✅ |
| 5.3 | No PR on branch | Sign in to GitHub. Open repo on `main`. Select text. Run "Gitnotate: Add Comment". | Shows warning: "No pull request found for the current branch." | ⬜ |
| 5.4 | Full comment flow | Sign in to GitHub. Open repo on a PR branch. Select text in a file. Run "Gitnotate: Add Comment". Enter comment text. | Debug Console: `[Gitnotate] Add Comment: { file: "...", line: N, ... }` then `[Gitnotate] POST https://api.github.com/...` then `[Gitnotate] createReviewComment succeeded: 201`. Shows "Comment posted successfully!" | ✅ |
| 5.5 | Cancel input | Select text, run "Add Comment", press Escape on input box. | No comment posted. No error. No debug output after input prompt. | ⬜ |
| 5.6 | API failure | Select text, run "Add Comment" on a repo where you don't have write access. | Debug Console: `[Gitnotate] createReviewComment failed: 422 Unprocessable Entity` with response body. Shows actionable error message (e.g., "You have a pending PR review..."). | ✅ |

---

## Test Suite 6: Add File Comment Command (Local Sidecar)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6.1 | Create sidecar comment | Select text in a `.md` file. Run "Gitnotate: Add File Comment". Enter comment. | Debug Console: `[Gitnotate] File comment: creating new sidecar for ...` then `[Gitnotate] File comment: selector = {...}` then `[Gitnotate] File comment: written to ...`. A `.comments/filename.md.json` file is created. | ⬜ |
| 6.2 | Append to existing sidecar | Run "Add File Comment" again on the same file with different selected text. | Debug Console: `[Gitnotate] File comment: appending to existing sidecar, 1 existing annotations`. The `.comments/filename.md.json` now has 2 annotations. | ⬜ |

---

## Test Suite 7: Enable/Disable Workspace

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7.1 | Enable workspace | Run "Gitnotate: Enable for Workspace" | Debug Console: `[Gitnotate] Settings: enabled workspace /path/to/repo`. Shows: "Gitnotate enabled for this workspace". | ⬜ |
| 7.2 | Disable workspace | Run "Gitnotate: Disable for Workspace" | Debug Console: `[Gitnotate] Settings: disabled workspace /path/to/repo`. Shows: "Gitnotate disabled for this workspace". | ⬜ |

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
