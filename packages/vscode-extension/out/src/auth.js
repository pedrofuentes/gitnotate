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
exports.getGitHubToken = getGitHubToken;
exports.ensureAuthenticated = ensureAuthenticated;
exports.onDidChangeAuth = onDidChangeAuth;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
const GITHUB_PROVIDER_ID = 'github';
const SCOPES = ['repo'];
async function getGitHubToken() {
    try {
        (0, logger_1.debug)('Auth: requesting GitHub session (silent)...');
        const session = await vscode.authentication.getSession(GITHUB_PROVIDER_ID, SCOPES);
        if (session) {
            (0, logger_1.debug)('Auth: session found, account:', session.account?.label ?? 'unknown');
        }
        else {
            (0, logger_1.debug)('Auth: no existing session');
        }
        return session?.accessToken;
    }
    catch (err) {
        (0, logger_1.warn)('getGitHubToken failed:', err);
        return undefined;
    }
}
async function ensureAuthenticated() {
    (0, logger_1.debug)('Auth: requesting GitHub session (with sign-in prompt)...');
    const session = await vscode.authentication.getSession(GITHUB_PROVIDER_ID, SCOPES, { createIfNone: true });
    if (!session) {
        throw new Error('GitHub authentication required. Please sign in to use Gitnotate.');
    }
    (0, logger_1.debug)('Auth: authenticated as', session.account?.label ?? 'unknown');
    return session.accessToken;
}
function onDidChangeAuth(listener) {
    return vscode.authentication.onDidChangeSessions(listener);
}
//# sourceMappingURL=auth.js.map