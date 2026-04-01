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
exports.addFileCommentCommand = addFileCommentCommand;
const vscode = __importStar(require("vscode"));
const core_1 = require("@gitnotate/core");
const sidecar_provider_1 = require("./sidecar-provider");
const utils_1 = require("./utils");
const logger_1 = require("./logger");
async function addFileCommentCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage('Select text first');
        return;
    }
    const documentText = editor.document.getText();
    const startOffset = editor.document.offsetAt(editor.selection.start);
    const endOffset = editor.document.offsetAt(editor.selection.end);
    const commentText = await vscode.window.showInputBox({
        prompt: 'Enter your file comment',
        placeHolder: 'Type your comment...',
    });
    if (commentText === undefined) {
        (0, logger_1.debug)('File comment: user cancelled input');
        return;
    }
    const relativePath = (0, utils_1.getRelativePath)(editor.document.fileName);
    (0, logger_1.debug)('File comment: file =', relativePath, 'offsets =', startOffset, '-', endOffset);
    let sidecar = await (0, sidecar_provider_1.readLocalSidecar)(editor.document.fileName);
    if (!sidecar) {
        (0, logger_1.debug)('File comment: creating new sidecar for', relativePath);
        sidecar = (0, core_1.createSidecarFile)(relativePath);
    }
    else {
        (0, logger_1.debug)('File comment: appending to existing sidecar,', sidecar.annotations.length, 'existing annotations');
    }
    const selector = (0, core_1.createSelector)(documentText, startOffset, endOffset);
    (0, logger_1.debug)('File comment: selector =', JSON.stringify(selector));
    const updatedSidecar = (0, core_1.addAnnotation)(sidecar, {
        target: selector,
        author: { github: 'local-user' },
        body: commentText,
    });
    await (0, sidecar_provider_1.writeLocalSidecar)(editor.document.fileName, updatedSidecar);
    (0, logger_1.debug)('File comment: written to', editor.document.fileName);
    vscode.window.showInformationMessage('File comment added!');
}
//# sourceMappingURL=file-comment-command.js.map