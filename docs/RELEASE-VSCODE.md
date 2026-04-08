# Release Process — VSCode Extension

This document covers the release process for the **Gitnotate VSCode extension**,
from version bump through Marketplace publication and post-release verification.

> For the browser extension release process, see
> [`RELEASE-BROWSER.md`](./RELEASE-BROWSER.md).

---

## Version Bump Checklist

Gitnotate follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking changes to the `^gn` metadata format or comment data schema
- **MINOR** — new features (e.g., new sidebar views, new comment actions)
- **PATCH** — bug fixes, performance improvements, documentation updates

> The VSCode extension and browser extension are versioned independently.

### Steps

1. **Update `packages/vscode-extension/package.json`**
   ```json
   "version": "X.Y.Z"
   ```

2. **Update `CHANGELOG.md`**
   - Move items from `[Unreleased]` into a new `[X.Y.Z] - YYYY-MM-DD` section
   - Follow [Keep a Changelog](https://keepachangelog.com/) format
   - Use `(VSCode Extension)` scope labels for clarity

3. **Commit the version bump**
   ```bash
   git add packages/vscode-extension/package.json CHANGELOG.md
   git commit -m "chore(release): bump vscode extension to vX.Y.Z"
   ```

4. **Create a git tag**
   ```bash
   git tag vscode-vX.Y.Z
   ```

5. **Push the tag** (triggers the `release-vscode.yml` GitHub Actions workflow)
   ```bash
   git push origin vscode-vX.Y.Z
   ```

6. **Verify the GitHub Release**
   - Go to https://github.com/pedrofuentes/gitnotate/releases
   - Confirm the release was created with the correct tag
   - Confirm the `.vsix` artifact is attached

---

## VS Code Marketplace

### First-Time Setup

1. **Create an Azure DevOps organization** (required even for individual
   developers — it's Microsoft's infrastructure for Marketplace auth)
   - Go to https://dev.azure.com and sign in with your Microsoft account
     (or create one)
   - If prompted, create a new organization — the name doesn't matter for
     publishing (e.g., `pedrofuentes-personal`)
   - You won't use this organization for anything else; it just enables PAT
     creation with Marketplace scope

2. **Create a publisher** at the
   [Visual Studio Marketplace — Manage Publishers](https://marketplace.visualstudio.com/manage)
   page
   - Click **"+ Create publisher"**
   - Set the **Publisher ID** to `pedrofuentes` (must match the `publisher`
     field in `package.json`)
   - Fill in **Display Name** (shown on the Marketplace page)
   - Optionally add a description, logo, and links

3. **Generate a Personal Access Token (PAT)**
   - Go to https://dev.azure.com and sign in
   - Click your **profile avatar** (top-right) → **Personal access tokens**
   - Click **+ New Token** and fill in:
     - **Name:** e.g., `vsce-marketplace-publish`
     - **Organization:** select **All accessible organizations** (required —
       the Marketplace is not scoped to a single org)
     - **Expiration:** choose up to 1 year (set a calendar reminder to rotate)
     - **Scopes:** select **Custom defined**, then click **Show all scopes**,
       then under **Marketplace** check **Manage**
   - Click **Create** and **copy the token immediately** — it is only shown
     once and cannot be retrieved later

4. **Verify the PAT works** (optional but recommended)
   ```bash
   npx @vscode/vsce login pedrofuentes
   # Paste your PAT when prompted — should show "Authentication successful"
   ```

5. **Add the PAT as a GitHub secret** (for automated publishing)
   - Go to repo Settings → Secrets and variables → Actions
   - Add secret: `VSCE_PAT` with the token value

6. **Prepare listing assets**
   - **Icon:** 128×128 PNG (currently `resources/icon.svg` — convert to PNG for
     the Marketplace listing)
   - **Screenshots:** 1280×800 PNG/JPEG (at least 1, up to 5)
   - **README:** The extension's README is displayed on the Marketplace page

### Manual Publishing (Fallback)

If the automated workflow fails or you need to publish manually:

```bash
cd packages/vscode-extension
npx @vscode/vsce package --no-dependencies
npx @vscode/vsce publish --no-dependencies -p $VSCE_PAT
```

### Updates

For subsequent releases, the `release-vscode.yml` workflow handles publishing
automatically when a `vscode-v*` tag is pushed.

---

## Open VSX Registry

[Open VSX](https://open-vsx.org/) makes the extension available to VSCodium and
other open-source VS Code forks.

### First-Time Setup

1. **Create an account** at https://open-vsx.org/ (via Eclipse Foundation / GitHub
   OAuth)

2. **Generate an access token**
   - Go to https://open-vsx.org/user-settings/tokens
   - Create a new token

3. **Add the token as a GitHub secret**
   - Add secret: `OVSX_PAT` with the token value

### Manual Publishing (Fallback)

```bash
cd packages/vscode-extension
npx @vscode/vsce package --no-dependencies
npx ovsx publish *.vsix -p $OVSX_PAT
```

### Updates

Automated via the same `release-vscode.yml` workflow — no manual steps needed
after initial setup.

---

## Post-Release Verification

After the extension is published on the Marketplace, verify end-to-end
functionality:

### 1. Installation

- [ ] Extension installs successfully from the VS Code Marketplace
- [ ] Extension appears in the activity bar (Gitnotate pin icon)
- [ ] Extension activates on opening a Markdown file

### 2. Authentication

- [ ] "Sign in to GitHub" prompt appears when no session exists
- [ ] GitHub authentication flow completes successfully
- [ ] Auth state persists across VS Code restarts
- [ ] Sign-out clears threads, highlights, and sidebar

### 3. PR Detection

- [ ] Status bar shows "Gitnotate: PR #N" when a PR exists for the current branch
- [ ] Status bar updates when switching branches
- [ ] Appropriate message shown when no PR exists

### 4. Comment Thread Display

- [ ] PR comments appear as VS Code comment threads in the editor
- [ ] `^gn` sub-line comments show character-level highlights (wavy underline)
- [ ] Regular line comments display at correct line positions
- [ ] Comments appear on correct side in diff views (old/LEFT vs new/RIGHT)
- [ ] Cache-first rendering: threads appear instantly on tab switch

### 5. Sidebar (Comments TreeView)

- [ ] All PR comments listed, grouped by file
- [ ] Click-to-navigate opens file at exact range
- [ ] Reply count shown per thread
- [ ] State messages: loading, no PR, no auth, no comments
- [ ] Manual refresh button works

### 6. Interactions

- [ ] Right-click → "Gitnotate: Add Comment" on text selection
- [ ] Reply to existing thread round-trips to GitHub API
- [ ] Resolve / Unresolve thread round-trips to GitHub API
- [ ] New comments appear after posting (auto-refresh)

### 7. Live Polling

- [ ] Comments refresh automatically every 30s (configurable)
- [ ] Polling pauses on window blur, resumes on focus
- [ ] ETag-based — no redundant fetches on `304 Not Modified`

### 8. Error Handling

- [ ] API errors show informative messages with action buttons
- [ ] Fetch timeout (15s) doesn't hang the editor
- [ ] Graceful degradation when offline

---

## Release Artifacts

Each release should include:

| Artifact | Location |
|----------|----------|
| Extension `.vsix` | GitHub Release (built by `release-vscode.yml`) |
| Source code | GitHub Release (auto-attached) |
| Changelog | `CHANGELOG.md` in repository root |

---

## Troubleshooting

### VS Code Marketplace Rejection

Common rejection reasons and fixes:

- **"Publisher not verified"** — Complete the publisher verification process in
  the Marketplace management portal
- **"Missing icon"** — Ensure a 128×128 icon is specified in `package.json` and
  included in the `.vsix`
- **"Functionality not working"** — Test the `.vsix` locally before publishing:
  ```bash
  code --install-extension gitnotate-X.Y.Z.vsix
  ```

### Open VSX Issues

- **"Token expired"** — Generate a new token at open-vsx.org and update the
  `OVSX_PAT` secret
- **"Namespace not found"** — Claim the `pedrofuentes` namespace on Open VSX
  before first publish

### Build Issues

If the release workflow fails:

```bash
# Build locally to reproduce
cd packages/vscode-extension
pnpm install
pnpm build

# Package the extension
npx @vscode/vsce package --no-dependencies

# Test the .vsix locally
code --install-extension gitnotate-*.vsix
```

### PAT Rotation

- VS Code Marketplace PATs expire (max 1 year). Set a calendar reminder.
- When rotating: generate new PAT → update `VSCE_PAT` secret → verify with a
  test publish to a pre-release channel.
