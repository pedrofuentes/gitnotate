"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCurrentPR = detectCurrentPR;
const logger_1 = require("./logger");
const REQUEST_TIMEOUT_MS = 10_000;
async function detectCurrentPR(gitService, token) {
    try {
        if (!gitService.isAvailable()) {
            (0, logger_1.debug)('PR detection: git not available');
            return null;
        }
        const branch = gitService.getCurrentBranch();
        if (!branch || gitService.isDefaultBranch())
            return null;
        const remoteUrl = gitService.getRemoteUrl();
        if (!remoteUrl) {
            (0, logger_1.debug)('PR detection: no remote URL found');
            return null;
        }
        const remote = gitService.parseGitHubOwnerRepo(remoteUrl);
        if (!remote)
            return null;
        const headers = {
            Accept: 'application/vnd.github+json',
        };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        const url = `https://api.github.com/repos/${encodeURIComponent(remote.owner)}/${encodeURIComponent(remote.repo)}/pulls?head=${encodeURIComponent(remote.owner)}:${encodeURIComponent(branch)}&state=open`;
        (0, logger_1.debug)('PR detection: fetching', url, token ? '(authenticated)' : '(unauthenticated)');
        const response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.status === 403 || response.status === 429) {
            (0, logger_1.warn)('GitHub API rate limit exceeded');
            return null;
        }
        if (!response.ok) {
            (0, logger_1.debug)('PR detection: API returned', response.status);
            return null;
        }
        const prs = await response.json();
        if (!Array.isArray(prs) || prs.length === 0) {
            (0, logger_1.debug)('PR detection: no open PRs for branch', branch);
            return null;
        }
        const pr = prs[0];
        (0, logger_1.debug)('PR detection: found PR #' + pr.number, `(${remote.owner}/${remote.repo})`);
        return {
            owner: remote.owner,
            repo: remote.repo,
            number: pr.number,
            headSha: pr.head.sha,
        };
    }
    catch (err) {
        (0, logger_1.error)('detectCurrentPR failed:', err);
        return null;
    }
}
//# sourceMappingURL=pr-detector.js.map