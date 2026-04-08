# Release Process — Browser Extension

This document covers the release process for the **Gitnotate browser extension**
(Chrome & Edge), from version bump through store submission and post-release
verification.

> For the VSCode extension release process, see
> [`RELEASE-VSCODE.md`](./RELEASE-VSCODE.md).

---

## Version Bump Checklist

Gitnotate follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking changes to the `^gn` metadata format or stored data schema
- **MINOR** — new features (e.g., new highlight modes, new page support)
- **PATCH** — bug fixes, performance improvements, documentation updates

### Steps

1. **Update `packages/browser-extension/package.json`**
   ```json
   "version": "X.Y.Z"
   ```

2. **Update `packages/browser-extension/manifest.json`**
   ```json
   "version": "X.Y.Z"
   ```

3. **Update `CHANGELOG.md`**
   - Move items from `[Unreleased]` into a new `[X.Y.Z] - YYYY-MM-DD` section
   - Follow [Keep a Changelog](https://keepachangelog.com/) format

4. **Commit the version bump**
   ```bash
   git add packages/browser-extension/package.json \
           packages/browser-extension/manifest.json \
           CHANGELOG.md
   git commit -m "chore(release): bump browser extension to vX.Y.Z"
   ```

5. **Create a git tag**
   ```bash
   git tag browser-vX.Y.Z
   ```

6. **Push the tag** (triggers the `release.yml` GitHub Actions workflow)
   ```bash
   git push origin browser-vX.Y.Z
   ```

7. **Verify the GitHub Release**
   - Go to https://github.com/pedrofuentes/gitnotate/releases
   - Confirm the release was created with the correct tag
   - Confirm the `.zip` artifact is attached

---

## Chrome Web Store Submission

### First-Time Setup

1. Register as a Chrome Web Store developer at
   https://chrome.google.com/webstore/devconsole (one-time $5 fee)
2. Prepare store listing assets:
   - **Icon:** 128×128 PNG (in extension assets)
   - **Screenshots:** 1280×800 or 640×400 PNG/JPEG (at least 1, up to 5)
   - **Promotional images:** optional — small tile (440×280), marquee (1400×560)

### Submission Steps

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"** (first release) or select the existing item (updates)
3. **Upload the `.zip`** from the GitHub Release artifacts
4. Fill in the **Store Listing** tab:
   - **Name:** Gitnotate
   - **Short description:** Use the content from
     `packages/browser-extension/store-listing/short-description.txt`
   - **Description:** Use the content from
     `packages/browser-extension/store-listing/description.md`
   - **Category:** Developer Tools (see `store-listing/category.txt`)
   - **Language:** English
5. Upload **screenshots** (at least 1 required)
6. Fill in the **Privacy** tab:
   - **Single purpose description:** "Sub-line commenting for GitHub PR reviews"
   - **Permission justifications:**
     - `activeTab` — needed to read and modify GitHub PR pages to add highlighting
       and comment injection
     - `storage` — needed to store user preferences, repository settings, and
       GitHub token locally
     - Host permission `github.com` — the extension only operates on GitHub pages
   - **Privacy policy URL:** `https://pedrofuentes.github.io/gitnotate/privacy-policy.html`
   - **Data use disclosures:** No data collected, no data sold, no data transferred
7. Set **Distribution** tab:
   - Visibility: Public
   - Regions: All regions (or as desired)
8. Click **"Submit for Review"**
   - Typical review time: **1–3 business days**
   - You'll receive an email when the review is complete

### Updates

For subsequent releases, go to the Developer Dashboard → select Gitnotate →
**Package** tab → upload the new `.zip` → **Submit for Review**.

---

## Edge Add-ons Submission

### First-Time Setup

1. Register at [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd)
   (free, requires a Microsoft account)

### Submission Steps

1. Go to the [Microsoft Partner Center — Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd)
2. Click **"Create new extension"** (first release) or select the existing item
3. **Upload the same `.zip`** used for Chrome (Manifest V3 is compatible with Edge)
4. Fill in the **Listing** details:
   - **Name:** Gitnotate
   - **Short description:** Use the content from `store-listing/short-description.txt`
   - **Description:** Use the content from `store-listing/description.md`
   - **Category:** Developer Tools
5. Upload **screenshots** (same ones used for Chrome Web Store)
6. Set the **Privacy policy URL:**
   `https://pedrofuentes.github.io/gitnotate/privacy-policy.html`
7. Click **"Submit for Review"**
   - Typical review time: **2–5 business days**
   - Status updates appear in Partner Center

### Updates

Upload the new `.zip` in Partner Center → submit for review.

---

## Post-Release Verification

After the extension is published in either store, verify end-to-end functionality:

### 1. Installation
- [ ] Extension installs successfully from the store
- [ ] Extension icon appears in the browser toolbar
- [ ] Popup opens and displays correctly

### 2. Authentication
- [ ] GitHub PAT can be entered and saved in the popup
- [ ] Token validation succeeds (shows authenticated user)
- [ ] Invalid tokens show an appropriate error

### 3. Core Functionality (on a real GitHub PR)
- [ ] Opt-in banner appears on a new repository's PR
- [ ] Enabling the repo works; disabling works
- [ ] Text selection in diff lines captures the correct range
- [ ] `^gn` metadata is injected into the comment textarea
- [ ] Submitted comments display with highlights in the diff
- [ ] Multiple comments on the same line get distinct highlight colors
- [ ] Comment threads are color-matched to their highlights
- [ ] `^gn` metadata is hidden in rendered comment view

### 4. Graceful Degradation
- [ ] Comments are readable without the extension (quoted fallback)
- [ ] Standard GitHub features still work (threading, resolve, @mentions)

### 5. Settings
- [ ] Highlight style preference can be changed (dashed/underline/background)
- [ ] Per-repo enable/disable/block works from the popup
- [ ] Token can be cleared from the popup

---

## Release Artifacts

Each release should include:

| Artifact | Location |
|----------|----------|
| Extension `.zip` | GitHub Release (built by `release.yml`) |
| Source code | GitHub Release (auto-attached) |
| Changelog | `CHANGELOG.md` in repository root |
| Store listing copy | `packages/browser-extension/store-listing/` |
| Privacy policy | https://pedrofuentes.github.io/gitnotate/privacy-policy.html |

---

## Troubleshooting

### Chrome Web Store Rejection

Common rejection reasons and fixes:

- **"Permission not justified"** — Update the permission justifications in the
  Privacy tab with more detailed explanations of why each permission is needed
- **"Missing privacy policy"** — Ensure the privacy policy URL is accessible and
  covers all required disclosures
- **"Functionality not working"** — Ensure the extension works on a fresh Chrome
  profile with no other extensions installed

### Build Issues

If the release workflow fails:

```bash
# Build locally to reproduce
cd packages/browser-extension
pnpm install
pnpm build

# The output zip is in dist/
```
