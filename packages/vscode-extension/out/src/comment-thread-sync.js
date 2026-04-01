"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentThreadSync = void 0;
exports.stripBlockquoteFallback = stripBlockquoteFallback;
const vscode = __importStar(require("vscode"));
const core_1 = require("@gitnotate/core");
const logger_1 = require("./logger");
// Matches the > 📌 **"quoted text"** (chars N–M) blockquote line
const BLOCKQUOTE_FALLBACK_RE = /^>\s*📌\s*\*\*".*?"\*\*\s*\(chars\s*\d+[–-]\d+\)\s*\n*/;
function stripBlockquoteFallback(text) {
    return text.replace(BLOCKQUOTE_FALLBACK_RE, '').trim();
}
class CommentThreadSync {
    prService;
    commentController;
    cache = new Map();
    constructor(prService, commentController) {
        this.prService = prService;
        this.commentController = commentController;
    }
    async syncForDocument(uri, relativePath, pr) {
        this.commentController.clearThreads(uri);
        const comments = await this.getComments(pr);
        const fileComments = comments.filter((c) => c.path === relativePath);
        (0, logger_1.debug)('Thread sync:', fileComments.length, 'comments for', relativePath);
        // Separate root comments (with ^gn metadata) from replies
        const rootComments = [];
        const repliesByParent = new Map();
        for (const comment of fileComments) {
            if (comment.inReplyToId !== undefined) {
                const existing = repliesByParent.get(comment.inReplyToId) ?? [];
                existing.push(comment);
                repliesByParent.set(comment.inReplyToId, existing);
            }
            else {
                rootComments.push(comment);
            }
        }
        let threadsCreated = 0;
        let gnThreads = 0;
        let lineThreads = 0;
        const highlightRanges = [];
        for (const root of rootComments) {
            const parsed = (0, core_1.parseGnComment)(root.body);
            const replies = repliesByParent.get(root.id) ?? [];
            if (parsed) {
                // ^gn comment: sub-line range + wavy underline
                const { metadata, userComment } = parsed;
                const cleanBody = stripBlockquoteFallback(userComment);
                const line = metadata.lineNumber - 1;
                const range = new vscode.Range(line, metadata.start, line, metadata.end);
                const threadComments = [
                    { body: cleanBody, author: root.userLogin ?? 'unknown' },
                ];
                for (const reply of replies) {
                    threadComments.push({ body: reply.body, author: reply.userLogin ?? 'unknown' });
                }
                this.commentController.createThread(uri, range, threadComments, gnThreads);
                highlightRanges.push(range);
                gnThreads++;
            }
            else {
                // Regular line comment: position at end of line, no underline highlight
                const line = (root.line ?? 1) - 1;
                const range = new vscode.Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER);
                const threadComments = [
                    { body: root.body, author: root.userLogin ?? 'unknown' },
                ];
                for (const reply of replies) {
                    threadComments.push({ body: reply.body, author: reply.userLogin ?? 'unknown' });
                }
                this.commentController.createThread(uri, range, threadComments);
                lineThreads++;
            }
            threadsCreated++;
        }
        (0, logger_1.debug)('Thread sync: created', threadsCreated, 'threads (' + gnThreads, '^gn +', lineThreads, 'line)');
        return highlightRanges;
    }
    invalidateCache() {
        this.cache.clear();
    }
    async getComments(pr) {
        const cacheKey = `${pr.owner}/${pr.repo}#${pr.number}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            (0, logger_1.debug)('Thread sync: using cached comments for', cacheKey);
            return cached;
        }
        (0, logger_1.debug)('Thread sync: fetching comments for', cacheKey);
        const comments = await this.prService.listReviewComments(pr);
        this.cache.set(cacheKey, comments);
        return comments;
    }
}
exports.CommentThreadSync = CommentThreadSync;
//# sourceMappingURL=comment-thread-sync.js.map