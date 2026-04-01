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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const settings_1 = require("./settings");
const comment_command_1 = require("./comment-command");
const pr_detector_1 = require("./pr-detector");
const git_service_1 = require("./git-service");
const auth_1 = require("./auth");
const logger_1 = require("./logger");
const comment_controller_1 = require("./comment-controller");
const comment_thread_sync_1 = require("./comment-thread-sync");
const pr_service_1 = require("./pr-service");
const utils_1 = require("./utils");
let commentCtrl;
let statusBarItem;
async function promptSignIn() {
    const action = await vscode.window.showInformationMessage('Gitnotate: Sign in to GitHub to enable sub-line commenting on this PR.', 'Sign In');
    if (action === 'Sign In') {
        try {
            await (0, auth_1.ensureAuthenticated)();
            (0, logger_1.debug)('User signed in — refreshing PR status bar');
            await updatePRStatusBar();
        }
        catch {
            (0, logger_1.debug)('User declined sign-in');
        }
    }
}
async function updatePRStatusBar() {
    (0, logger_1.debug)('Updating PR status bar...');
    const gitService = new git_service_1.GitService();
    const token = await (0, auth_1.getGitHubToken)();
    (0, logger_1.debug)('Auth token:', token ? 'present' : 'absent');
    const pr = await (0, pr_detector_1.detectCurrentPR)(gitService, token);
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    if (pr) {
        (0, logger_1.debug)('PR detected:', `${pr.owner}/${pr.repo}#${pr.number}`);
        statusBarItem.text = `$(git-pull-request) Gitnotate: PR #${pr.number}`;
        statusBarItem.tooltip = `${pr.owner}/${pr.repo}#${pr.number}`;
        statusBarItem.show();
        if (!token) {
            promptSignIn();
        }
    }
    else {
        (0, logger_1.debug)('No PR detected — status bar hidden');
        statusBarItem.hide();
    }
}
function activate(context) {
    (0, logger_1.initLogger)(context);
    (0, logger_1.debug)('Extension activating...');
    commentCtrl = new comment_controller_1.CommentController();
    context.subscriptions.push({ dispose: () => commentCtrl?.dispose() });
    const debouncedSync = (0, utils_1.debounce)(async (editor) => {
        (0, logger_1.debug)('Comment sync: editor changed →', editor.document.fileName, `(${editor.document.languageId})`);
        if (editor.document.languageId !== 'markdown') {
            (0, logger_1.debug)('Comment sync: not markdown — skipping');
            return;
        }
        const token = await (0, auth_1.getGitHubToken)();
        if (!token) {
            (0, logger_1.debug)('Comment sync: no auth token — skipping');
            return;
        }
        const gitService = new git_service_1.GitService();
        const pr = await (0, pr_detector_1.detectCurrentPR)(gitService, token);
        if (!pr) {
            (0, logger_1.debug)('Comment sync: no PR found — skipping');
            return;
        }
        const prService = new pr_service_1.PrService(token);
        if (!commentCtrl)
            return;
        const sync = new comment_thread_sync_1.CommentThreadSync(prService, commentCtrl);
        const relativePath = (0, utils_1.getRelativePath)(editor.document.fileName);
        (0, logger_1.debug)('Comment sync: syncing', relativePath, `(PR #${pr.number})`);
        const highlightRanges = await sync.syncForDocument(editor.document.uri, relativePath, pr);
        if (highlightRanges.length > 0) {
            commentCtrl.applyHighlights(editor, highlightRanges);
        }
        else {
            commentCtrl.clearHighlights(editor);
        }
    }, 300);
    const triggerSync = () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            debouncedSync(editor);
        }
    };
    context.subscriptions.push(vscode.commands.registerCommand('gitnotate.enable', async () => {
        await (0, settings_1.enableWorkspace)();
        vscode.window.showInformationMessage('Gitnotate enabled for this workspace');
    }), vscode.commands.registerCommand('gitnotate.disable', async () => {
        await (0, settings_1.disableWorkspace)();
        vscode.window.showInformationMessage('Gitnotate disabled for this workspace');
    }), vscode.commands.registerCommand('gitnotate.addComment', () => (0, comment_command_1.addCommentCommand)(context, triggerSync)));
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        (0, logger_1.debug)('Editor changed:', editor ? editor.document.fileName : '(none)');
        if (editor) {
            debouncedSync(editor);
        }
    });
    context.subscriptions.push(editorChangeDisposable);
    context.subscriptions.push({ dispose: () => debouncedSync.dispose() });
    (0, logger_1.debug)('Commands registered: enable, disable, addComment');
    updatePRStatusBar();
    // Sync the already-open editor (onDidChangeActiveTextEditor doesn't fire for it).
    // The vscode.git extension loads asynchronously — repos may not be available yet.
    // Retry with increasing delays until git is ready or we give up.
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 3000, 4000, 5000];
    let retryTimer;
    const tryInitialSync = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const gitService = new git_service_1.GitService();
        if (!gitService.isAvailable()) {
            retryCount++;
            if (retryCount <= maxRetries) {
                (0, logger_1.debug)('Initial sync: git not ready, retry', retryCount, 'of', maxRetries);
                retryTimer = setTimeout(tryInitialSync, retryDelays[retryCount - 1]);
            }
            else {
                (0, logger_1.debug)('Initial sync: git not available after', maxRetries, 'retries — giving up');
            }
            return;
        }
        (0, logger_1.debug)('Initial sync: triggering for', editor.document.fileName);
        debouncedSync(editor);
    };
    retryTimer = setTimeout(tryInitialSync, 500);
    context.subscriptions.push({ dispose: () => { if (retryTimer)
            clearTimeout(retryTimer); } });
}
function deactivate() {
    (0, logger_1.debug)('Extension deactivating...');
    if (commentCtrl) {
        commentCtrl.dispose();
        commentCtrl = undefined;
    }
    statusBarItem?.dispose();
}
//# sourceMappingURL=extension.js.map