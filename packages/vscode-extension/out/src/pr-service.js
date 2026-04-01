"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrService = void 0;
const BASE_URL = 'https://api.github.com';
const PER_PAGE = 100;
class PrService {
    token;
    constructor(token) {
        this.token = token;
    }
    headers() {
        return {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
        };
    }
    async createReviewComment(pr, filePath, line, side, body) {
        const url = `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`;
        const payload = {
            body,
            commit_id: pr.headSha,
            path: filePath,
            line,
            side,
        };
        try {
            console.log('[Gitnotate] POST', url);
            console.log('[Gitnotate] Payload:', JSON.stringify(payload, null, 2));
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorBody = await response.text().catch(() => '(could not read body)');
                console.error('[Gitnotate] createReviewComment failed:', response.status, response.statusText);
                console.error('[Gitnotate] Response body:', errorBody);
                return { ok: false, userMessage: this.parseApiError(response.status, errorBody) };
            }
            console.log('[Gitnotate] createReviewComment succeeded:', response.status);
            return { ok: true };
        }
        catch (err) {
            console.error('[Gitnotate] createReviewComment failed:', err);
            return { ok: false, userMessage: 'Network error — check your connection and try again.' };
        }
    }
    parseApiError(status, body) {
        try {
            const parsed = JSON.parse(body);
            const errors = parsed.errors ?? [];
            const firstError = errors[0]?.message ?? parsed.message ?? '';
            if (firstError.includes('pending review')) {
                return 'You have a pending PR review. Submit or discard it on GitHub, then try again.';
            }
            if (firstError.includes('commit_id') || firstError.includes('No commit found')) {
                return 'The branch is out of sync with the PR. Push your latest changes or pull the PR head commit.';
            }
            if (firstError.includes('path')) {
                return `File not found in the PR diff. Make sure "${firstError}" is part of this PR's changes.`;
            }
            if (status === 403) {
                return 'Permission denied. You may not have write access to this repository.';
            }
            if (status === 404) {
                return 'PR not found. It may have been closed or merged.';
            }
            return `GitHub API error (${status}): ${firstError || body}`;
        }
        catch {
            return `GitHub API error (${status}). Check the Debug Console for details.`;
        }
    }
    async listReviewComments(pr) {
        const allComments = [];
        let page = 1;
        try {
            while (true) {
                const url = `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments?per_page=${PER_PAGE}&page=${page}`;
                console.log('[Gitnotate] GET', url);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: this.headers(),
                });
                if (!response.ok) {
                    console.error('[Gitnotate] listReviewComments failed:', response.status, response.statusText);
                    return allComments;
                }
                const data = (await response.json());
                for (const c of data) {
                    allComments.push({
                        id: c.id,
                        body: c.body,
                        path: c.path,
                        line: c.line,
                        side: c.side,
                        inReplyToId: c.in_reply_to_id,
                        userLogin: c.user?.login,
                        createdAt: c.created_at,
                        updatedAt: c.updated_at,
                    });
                }
                if (data.length < PER_PAGE)
                    break;
                page++;
            }
            return allComments;
        }
        catch (err) {
            console.error('[Gitnotate] listReviewComments failed:', err);
            return [];
        }
    }
}
exports.PrService = PrService;
//# sourceMappingURL=pr-service.js.map