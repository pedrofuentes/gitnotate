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
exports.addCommentCommand = addCommentCommand;
const vscode = __importStar(require("vscode"));
const core_1 = require("@gitnotate/core");
const pr_service_1 = require("./pr-service");
const pr_detector_1 = require("./pr-detector");
const utils_1 = require("./utils");
const git_service_1 = require("./git-service");
const auth_1 = require("./auth");
const logger_1 = require("./logger");
async function addCommentCommand(_context, onCommentPosted) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage('Select text first');
        return;
    }
    // Authenticate via OAuth
    const token = await (0, auth_1.getGitHubToken)();
    if (!token) {
        vscode.window.showErrorMessage('GitHub authentication required. Please sign in to GitHub.');
        return;
    }
    // Detect current PR
    const gitService = new git_service_1.GitService();
    const pr = await (0, pr_detector_1.detectCurrentPR)(gitService, token);
    if (!pr) {
        vscode.window.showWarningMessage('No pull request found for the current branch.');
        return;
    }
    // Prompt for comment text
    const userComment = await vscode.window.showInputBox({
        prompt: 'Enter your comment for the selected text',
        placeHolder: 'Type your comment...',
    });
    if (userComment === undefined) {
        return; // User cancelled
    }
    // Build ^gn comment
    const selectedText = editor.document.getText(editor.selection);
    const metadata = {
        exact: selectedText,
        lineNumber: editor.selection.start.line + 1,
        side: 'R',
        start: editor.selection.start.character,
        end: editor.selection.end.character,
    };
    const commentBody = (0, core_1.buildGnComment)(metadata, userComment);
    // Submit via GitHub API
    const client = new pr_service_1.PrService(token);
    const filePath = (0, utils_1.getRelativePath)(editor.document.fileName);
    const line = editor.selection.start.line + 1;
    (0, logger_1.debug)('Add Comment:', { file: filePath, line, side: 'RIGHT', pr: `${pr.owner}/${pr.repo}#${pr.number}`, headSha: pr.headSha });
    (0, logger_1.debug)('Comment body:', commentBody);
    const result = await client.createReviewComment(pr, filePath, line, 'RIGHT', commentBody);
    if (result.ok) {
        vscode.window.showInformationMessage('Comment posted successfully!');
        onCommentPosted?.();
    }
    else {
        vscode.window.showErrorMessage(`Gitnotate: ${result.userMessage ?? 'Failed to post comment.'}`);
    }
}
//# sourceMappingURL=comment-command.js.map