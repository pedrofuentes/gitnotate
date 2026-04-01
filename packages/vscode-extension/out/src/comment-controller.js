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
exports.CommentController = void 0;
const vscode = __importStar(require("vscode"));
const HIGHLIGHT_COLORS = [
    '#f9a825', // yellow
    '#1e88e5', // blue
    '#8e24aa', // purple
    '#ef6c00', // orange
    '#00897b', // teal
    '#c2185b', // pink
];
const COLOR_EMOJIS = [
    '🟡', // yellow
    '🔵', // blue
    '🟣', // purple
    '🟠', // orange
    '🟢', // teal
    '🔴', // pink
];
class CommentController {
    controller;
    threads = new Map();
    decorationTypes;
    constructor() {
        this.controller = vscode.comments.createCommentController('gitnotate', 'Gitnotate Sub-line Comments');
        this.decorationTypes = HIGHLIGHT_COLORS.map((color) => vscode.window.createTextEditorDecorationType({
            textDecoration: `underline wavy ${color}`,
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane?.Center,
        }));
        this.controller.commentingRangeProvider = {
            provideCommentingRanges(document) {
                if (document.languageId !== 'markdown')
                    return [];
                const ranges = [];
                for (let i = 0; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    if (!line.isEmptyOrWhitespace) {
                        ranges.push(line.range);
                    }
                }
                return ranges;
            },
        };
    }
    getColorIndex(rangeIndex) {
        return rangeIndex % HIGHLIGHT_COLORS.length;
    }
    getColorHex(rangeIndex) {
        return HIGHLIGHT_COLORS[this.getColorIndex(rangeIndex)];
    }
    createThread(uri, range, comments, colorIndex) {
        const colorEmoji = colorIndex !== undefined ? COLOR_EMOJIS[colorIndex % COLOR_EMOJIS.length] : undefined;
        const vscodeComments = comments.map((c) => ({
            body: c.body,
            mode: vscode.CommentMode.Preview,
            author: { name: c.author },
            label: colorEmoji,
        }));
        const thread = this.controller.createCommentThread(uri, range, vscodeComments);
        const key = uri.fsPath;
        const existing = this.threads.get(key) ?? [];
        existing.push(thread);
        this.threads.set(key, existing);
        return thread;
    }
    applyHighlights(editor, ranges) {
        // Group ranges by color index
        const colorBuckets = new Map();
        for (let i = 0; i < ranges.length; i++) {
            const colorIdx = this.getColorIndex(i);
            const bucket = colorBuckets.get(colorIdx) ?? [];
            bucket.push(ranges[i]);
            colorBuckets.set(colorIdx, bucket);
        }
        // Apply each color's ranges to its decoration type
        for (let i = 0; i < this.decorationTypes.length; i++) {
            const bucket = colorBuckets.get(i);
            if (bucket) {
                editor.setDecorations(this.decorationTypes[i], bucket);
            }
        }
    }
    clearHighlights(editor) {
        for (const decorationType of this.decorationTypes) {
            editor.setDecorations(decorationType, []);
        }
    }
    clearThreads(uri) {
        if (uri) {
            const key = uri.fsPath;
            const threads = this.threads.get(key);
            if (threads) {
                for (const thread of threads) {
                    thread.dispose();
                }
                this.threads.delete(key);
            }
        }
        else {
            for (const threads of this.threads.values()) {
                for (const thread of threads) {
                    thread.dispose();
                }
            }
            this.threads.clear();
        }
    }
    dispose() {
        this.clearThreads();
        for (const decorationType of this.decorationTypes) {
            decorationType.dispose();
        }
        this.controller.dispose();
    }
}
exports.CommentController = CommentController;
//# sourceMappingURL=comment-controller.js.map